import type { SessionResponse } from '@nova/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import {
  computeIdleSchedulePlan,
  deriveSessionTimings,
  mapBroadcastLogoutReason,
  parseSessionContactMs,
  type SessionEndCallbackReason,
  subscribeWindowActivity,
} from '../idle-schedule.ts';
import type { SessionBroadcaster } from '../services/session-broadcaster.ts';
import { SESSION_QUERY_KEY } from './useSession.ts';

export interface UseIdleTimerOptions {
  session: SessionResponse | null;
  onSessionEnded: (reason: SessionEndCallbackReason) => void;
}

export interface UseIdleTimerResult {
  warningOpen: boolean;
  secondsLeft: number;
  isRefreshing: boolean;
  stayConnected: () => Promise<void>;
  logoutNow: () => Promise<void>;
}

/**
 * Supervisa la inactividad desde el último contacto exitoso con el servidor (research R3),
 * respeta el límite absoluto de 12 h sin mostrar aviso (spec.md) y sincroniza pestañas
 * mediante `SessionBroadcaster`.
 */
export function useIdleTimer({ session, onSessionEnded }: UseIdleTimerOptions): UseIdleTimerResult {
  const { httpClient, authService, createBroadcaster } = useAuthServices();
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
  const broadcasterRef = useRef<SessionBroadcaster | null>(null);
  const onSessionEndedRef = useRef(onSessionEnded);
  onSessionEndedRef.current = onSessionEnded;

  const timings = useMemo(() => deriveSessionTimings(session), [session]);

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

  const dismissWarning = useCallback(() => {
    warningOpenRef.current = false;
    setWarningOpen(false);
  }, []);

  const triggerAbsoluteExpiry = useCallback(() => {
    if (timedOutRef.current) return;
    timedOutRef.current = true;
    clearTimers();
    dismissWarning();
    broadcasterRef.current?.publish({ type: 'logout', reason: 'expired' });
    onSessionEndedRef.current('expirada');
  }, [clearTimers, dismissWarning]);

  const triggerIdleLogout = useCallback(async () => {
    if (timedOutRef.current) return;
    timedOutRef.current = true;
    clearTimers();
    dismissWarning();
    try {
      await authService.logout();
    } catch {
      // Cerramos el estado local aunque el servidor ya haya revocado la sesión.
    }
    broadcasterRef.current?.publish({ type: 'logout', reason: 'idle' });
    onSessionEndedRef.current('idle');
  }, [authService, clearTimers, dismissWarning]);

  const scheduleFromContact = useCallback(
    (contactMs: number) => {
      if (!session) return;
      contactAtRef.current = contactMs;
      timedOutRef.current = false;
      clearTimers();

      const plan = computeIdleSchedulePlan(Date.now(), contactMs, timings);

      if (plan.mode === 'absolute') {
        if (plan.delayMs === 0) triggerAbsoluteExpiry();
        else warningTimerRef.current = setTimeout(triggerAbsoluteExpiry, plan.delayMs);
        return;
      }

      const openWarning = () => {
        if (Date.now() >= timings.absoluteExpiresMs) {
          triggerAbsoluteExpiry();
          return;
        }
        const remaining = Math.max(0, Math.ceil((plan.idleDeadlineAt - Date.now()) / 1000));
        if (remaining <= 0) {
          void triggerIdleLogout();
          return;
        }
        warningOpenRef.current = true;
        setWarningOpen(true);
        setSecondsLeft(remaining);

        countdownIntervalRef.current = setInterval(() => {
          if (Date.now() >= timings.absoluteExpiresMs) {
            triggerAbsoluteExpiry();
            return;
          }
          const left = Math.max(0, Math.ceil((plan.idleDeadlineAt - Date.now()) / 1000));
          setSecondsLeft(left);
          if (left <= 0) void triggerIdleLogout();
        }, 1_000);
      };

      if (plan.warningDelayMs === 0) openWarning();
      else warningTimerRef.current = setTimeout(openWarning, plan.warningDelayMs);
    },
    [clearTimers, session, timings, triggerAbsoluteExpiry, triggerIdleLogout],
  );

  const triggerThrottledRefresh = useCallback(async () => {
    if (!session || warningOpenRef.current || refreshingRef.current) return;
    if (Date.now() >= timings.absoluteExpiresMs) {
      triggerAbsoluteExpiry();
      return;
    }
    if (Date.now() - contactAtRef.current < timings.refreshThrottleMs) return;

    refreshingRef.current = true;
    try {
      const updated = await authService.refreshSession();
      const now = httpClient.lastServerContactAt ?? Date.now();
      queryClient.setQueryData(SESSION_QUERY_KEY, updated);
      scheduleFromContact(now);
      broadcasterRef.current?.publish({ type: 'activity', serverContactAt: now });
    } catch {
      // Si la sesión venció, HttpClient dispara el callback SESSION_EXPIRED.
    } finally {
      refreshingRef.current = false;
    }
  }, [
    authService,
    httpClient,
    queryClient,
    scheduleFromContact,
    session,
    timings,
    triggerAbsoluteExpiry,
  ]);

  const stayConnected = useCallback(async () => {
    if (!session || refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const updated = await authService.refreshSession();
      const now = httpClient.lastServerContactAt ?? Date.now();
      queryClient.setQueryData(SESSION_QUERY_KEY, updated);
      dismissWarning();
      scheduleFromContact(now);
      broadcasterRef.current?.publish({ type: 'keepalive', serverContactAt: now });
    } catch {
      clearTimers();
      dismissWarning();
      onSessionEndedRef.current('expirada');
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [
    authService,
    clearTimers,
    dismissWarning,
    httpClient,
    queryClient,
    scheduleFromContact,
    session,
  ]);

  const logoutNow = useCallback(async () => {
    clearTimers();
    dismissWarning();
    try {
      await authService.logout();
    } catch {
      // Limpiamos sesión local incluso si hay error de red.
    }
    broadcasterRef.current?.publish({ type: 'logout', reason: 'logout' });
    onSessionEndedRef.current('logout');
  }, [authService, clearTimers, dismissWarning]);

  useEffect(() => {
    if (!session) {
      clearTimers();
      dismissWarning();
      return;
    }
    scheduleFromContact(parseSessionContactMs(httpClient.lastServerContactAt, session));
    const unsubscribe = httpClient.subscribeServerContact((timestamp) => {
      if (!warningOpenRef.current) scheduleFromContact(timestamp);
    });
    return () => {
      unsubscribe();
      clearTimers();
    };
  }, [clearTimers, dismissWarning, httpClient, scheduleFromContact, session]);

  useEffect(() => {
    if (!session) return;
    return subscribeWindowActivity(() => {
      void triggerThrottledRefresh();
    });
  }, [session, triggerThrottledRefresh]);

  useEffect(() => {
    if (!session) return;
    void triggerThrottledRefresh();
  }, [location.pathname, location.search, session, triggerThrottledRefresh]);

  useEffect(() => {
    if (!session) return;
    const broadcaster = createBroadcaster();
    broadcasterRef.current = broadcaster;

    const unsubscribe = broadcaster.subscribe((msg) => {
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
        dismissWarning();
        scheduleFromContact(Math.max(contactAtRef.current, msg.serverContactAt ?? Date.now()));
        return;
      }

      clearTimers();
      dismissWarning();
      onSessionEndedRef.current(mapBroadcastLogoutReason(msg.reason));
    });

    return () => {
      unsubscribe();
      broadcaster.dispose();
      if (broadcasterRef.current === broadcaster) broadcasterRef.current = null;
    };
  }, [
    clearTimers,
    createBroadcaster,
    dismissWarning,
    scheduleFromContact,
    session,
    triggerThrottledRefresh,
  ]);

  return { warningOpen, secondsLeft, isRefreshing, stayConnected, logoutNow };
}
