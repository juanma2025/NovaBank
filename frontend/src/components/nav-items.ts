import {
  CreditCard,
  Home,
  List,
  PiggyBank,
  PlusCircle,
  Send,
  ShoppingBag,
  User,
} from 'lucide-react';

import { NAV_MESSAGES } from '../lib/messages.ts';

export const DESKTOP_NAV_ITEMS = [
  { to: '/inicio', label: NAV_MESSAGES.home, icon: Home },
  { to: '/enviar', label: NAV_MESSAGES.send, icon: Send },
  { to: '/tarjetas', label: NAV_MESSAGES.cards, icon: CreditCard },
  { to: '/metas', label: NAV_MESSAGES.goals, icon: PiggyBank },
  { to: '/tienda', label: NAV_MESSAGES.store, icon: ShoppingBag },
  { to: '/recargar', label: NAV_MESSAGES.topup, icon: PlusCircle },
  { to: '/movimientos', label: NAV_MESSAGES.movements, icon: List },
  { to: '/perfil', label: NAV_MESSAGES.profile, icon: User },
] as const;

export const MOBILE_PRIMARY_ITEMS = [
  { to: '/inicio', label: NAV_MESSAGES.home, icon: Home },
  { to: '/enviar', label: NAV_MESSAGES.send, icon: Send },
  { to: '/tarjetas', label: NAV_MESSAGES.cards, icon: CreditCard },
  { to: '/recargar', label: NAV_MESSAGES.topup, icon: PlusCircle },
] as const;

export const MOBILE_MORE_ITEMS = [
  { to: '/metas', label: NAV_MESSAGES.goals, icon: PiggyBank },
  { to: '/tienda', label: NAV_MESSAGES.store, icon: ShoppingBag },
  { to: '/movimientos', label: NAV_MESSAGES.movements, icon: List },
  { to: '/perfil', label: NAV_MESSAGES.profile, icon: User },
] as const;
