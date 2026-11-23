import type { Movement } from '@nova/shared';

import { MOVEMENT_MESSAGES } from '../../../lib/messages.ts';
import { MovementItem } from './MovementItem.tsx';

export interface MovementListProps {
  movements: readonly Movement[];
  hideAmounts?: boolean;
  ariaLabel?: string;
}

export function MovementList({
  movements,
  hideAmounts = false,
  ariaLabel = MOVEMENT_MESSAGES.listAriaLabel,
}: MovementListProps) {
  return (
    <ul aria-label={ariaLabel} className="divide-y divide-border">
      {movements.map((movement) => (
        <MovementItem key={movement.id} movement={movement} hideAmount={hideAmounts} />
      ))}
    </ul>
  );
}
