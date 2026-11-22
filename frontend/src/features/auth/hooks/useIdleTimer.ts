import type { SessionResponse } from '@nova/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { getLastServerContactAt, subscribeServerContact } from '../../../lib/api-client.ts';
import { logout, refreshSession } from '../api.ts';
import { type SessionBroadcastMessage, subscribeSessionChannel } from '../session-channel.ts';
import { SESSION_QUERY_KEY } from './useSession.ts';

export interface UseIdleTimerOptions {
  session: SessionResponse | null;
  onSessionEnded: (reason: 'idle' | 'expirada' | 'logout') => void;
}

export interface UseIdleTimerResult {
  warningOpen: boolean;
  secondsLeft: number;
  isRefreshing: boolean;
  stayConnected: () => Promise<void>;
  logoutNow: () => Promise<void>;
}

const MAX_REFRESH_THROTTLE_MS = 60_000;

function parseSessionContactMs(session: SessionResponse): number {
  const fromClient = getLastServerContactAt();
  if (fromClient !== null) return fromClient;
  const parsed = Date.parse(session.session.lastActivityAt);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/**
 * Supervisa la inactividad desde el último contacto exitoso con el servidor (research R3),
 * sincroniza pestañas con `BroadcastChannel('nova-session')` y gestiona «Seguir conectado».
 */
export function useIdleTimer({ session, onSessionEnded }: UseIdleTimerOptions): UseIdleTimerResult {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const contactAtRef = useRef<number>(Date.now());
  const warningOpenRef = useRef(false);
  const refreshingRef = useRef(false);
  const timedOutRef = useRef(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postChannelRef = useRef<((message: SessionBroadcastMessage) => void) | null>(null);
  const onSessionEndedRef = useRef(onSessionEnded);
  onSessionEndedRef.current = onSessionEnded;

  const idleTimeoutMs = session ? session.session.idleTimeoutSeconds * 1000 : 0;
  const idleWarningMs = session ? session.session.idleWarningSeconds * 1000 : 0;
  const warningDelayMs = Math.max(0, idleTimeoutMs - idleWarningMs);
  const refreshThrottleMs = Math.min(
    MAX_REFRESH_THROTTLE_MS,
    Math.max(1_000, Math.floor(warningDelayMs / 2)),
  );

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current !== null) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const triggerIdleLogout = useCallback(async () => {
    if (timedOutRef.current) return;
    timedOutRef.current = true;
    clearTimers();
    warningOpenRef.current = false;
    setWarningOpen(false);
    try {
      await logout();
    } catch {
      // Cerramos el estado local aunque el servidor ya haya revocado la sesión.
    }
    postChannelRef.current?.({ type: 'logout', reason: 'idle' });
    onSessionEndedRef.current('idle');
  }, [clearTimers]);

  const scheduleFromContact = useCallback(
    (contactMs: number) => {
      if (!session) return;
      contactAtRef.current = contactMs;
      timedOutRef.current = false;
      clearTimers();

      const warningAt = contactMs + warningDelayMs;
      const deadlineAt = contactMs + idleTimeoutMs;
      const delay = Math.max(0, warningAt - Date.now());

      const openWarning = () => {
        const remaining = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
        if (remaining <= 0) {
          void triggerIdleLogout();
          return;
        }
        warningOpenRef.current = true;
        setWarningOpen(true);
        setSecondsLeft(remaining);

        countdownIntervalRef.current = setInterval(() => {
          const left = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
          setSecondsLeft(left);
          if (left <= 0) void triggerIdleLogout();
        }, 1_000);
      };

      if (delay === 0) {
        openWarning();
      } else {
        warningTimerRef.current = setTimeout(openWarning, delay);
      }
    },
    [clearTimers, idleTimeoutMs, session, triggerIdleLogout, warningDelayMs],
  );

  const triggerThrottledRefresh = useCallback(async () => {
    if (!session || warningOpenRef.current || refreshingRef.current) return;
    if (Date.now() - contactAtRef.current < refreshThrottleMs) return;

    refreshingRef.current = true;
    try {
      const updated = await refreshSession();
      const now = getLastServerContactAt() ?? Date.now();
      queryClient.setQueryData(SESSION_QUERY_KEY, updated);
      scheduleFromContact(now);
      postChannelRef.current?.({ type: 'activity', serverContactAt: now });
    } catch {
      // Si la sesión venció, api-client dispara el callback SESSION_EXPIRED.
    } finally {
      refreshingRef.current = false;
    }
  }, [queryClient, refreshThrottleMs, scheduleFromContact, session]);

  const stayConnected = useCallback(async () => {
    if (!session || refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const updated = await refreshSession();
      const now = getLastServerContactAt() ?? Date.now();
      queryClient.setQueryData(SESSION_QUERY_KEY, updated);
      warningOpenRef.current = false;
      setWarningOpen(false);
      scheduleFromContact(now);
      postChannelRef.current?.({ type: 'keepalive', serverContactAt: now });
    } catch {
      clearTimers();
      warningOpenRef.current = false;
      setWarningOpen(false);
      onSessionEndedRef.current('expirada');
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [clearTimers, queryClient, scheduleFromContact, session]);

  const logoutNow = useCallback(async () => {
    clearTimers();
    warningOpenRef.current = false;
    setWarningOpen(false);
    try {
      await logout();
    } catch {
      // Limpiamos sesión local incluso si hay error de red.
    }
    postChannelRef.current?.({ type: 'logout', reason: 'logout' });
    onSessionEndedRef.current('logout');
  }, [clearTimers]);

  useEffect(() => {
    if (!session) {
      clearTimers();
      warningOpenRef.current = false;
      setWarningOpen(false);
      return;
    }

    scheduleFromContact(parseSessionContactMs(session));
    const unsubscribe = subscribeServerContact((timestamp) => {
      if (!warningOpenRef.current) scheduleFromContact(timestamp);
    });

    return () => {
      unsubscribe();
      clearTimers();
    };
  }, [clearTimers, scheduleFromContact, session]);

  useEffect(() => {
    if (!session) return;
    const handleActivity = () => {
      void triggerThrottledRefresh();
    };
    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [session, triggerThrottledRefresh]);

  useEffect(() => {
    if (!session) return;
    void triggerThrottledRefresh();
  }, [location.pathname, location.search, session, triggerThrottledRefresh]);

  useEffect(() => {
    if (!session) return;
    const subscription = subscribeSessionChannel((msg) => {
      if (msg.type === 'activity') {
        if (typeof msg.serverContactAt === 'number') {
          const next = Math.max(contactAtRef.current, msg.serverContactAt);
          if (!warningOpenRef.current) scheduleFromContact(next);
        } else {
          void triggerThrottledRefresh();
        }
        return;
      }

      if (msg.type === 'keepalive') {
        const next = Math.max(contactAtRef.current, msg.serverContactAt ?? Date.now());
        warningOpenRef.current = false;
        setWarningOpen(false);
        scheduleFromContact(next);
        return;
      }

      clearTimers();
      warningOpenRef.current = false;
      setWarningOpen(false);
      onSessionEndedRef.current(msg.reason === 'idle' ? 'idle' : 'logout');
    });

    if (!subscription) return;
    postChannelRef.current = subscription.post;
    return () => {
      subscription.close();
      postChannelRef.current = null;
    };
  }, [clearTimers, scheduleFromContact, session, triggerThrottledRefresh]);

  return { warningOpen, secondsLeft, isRefreshing, stayConnected, logoutNow };
}
