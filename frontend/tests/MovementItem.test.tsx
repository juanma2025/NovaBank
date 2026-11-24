import type { Movement } from '@nova/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MovementItem } from '../src/features/home/components/MovementItem.tsx';

describe('MovementItem — tipo transfer y nota (spec 003 · T020)', () => {
  it('renderiza transferencias salientes (-) y entrantes (+) con descripción y nota', () => {
    const outgoing: Movement = {
      id: '88888888-8888-4888-8888-888888888881',
      transactionId: '99999999-9999-4999-8999-999999999991',
      type: 'transfer',
      description: 'Transferencia a Ana P. G.',
      note: 'Almuerzo del martes',
      amount: -15_000,
      status: 'completed',
      createdAt: '2026-11-22T18:00:00.000Z',
    };
    const incoming: Movement = {
      ...outgoing,
      id: '88888888-8888-4888-8888-888888888882',
      description: 'Transferencia de Carlos G.',
      amount: 15_000,
    };

    render(
      <ul>
        <MovementItem movement={outgoing} />
        <MovementItem movement={incoming} />
      </ul>,
    );

    expect(screen.getByText('Transferencia a Ana P. G.')).toBeTruthy();
    expect(screen.getByText('Transferencia de Carlos G.')).toBeTruthy();
    expect(screen.getAllByText('Almuerzo del martes')).toHaveLength(2);
    expect(screen.getByText(/-\$\s*15\.000/)).toBeTruthy();
    expect(screen.getByText(/\+\$\s*15\.000/)).toBeTruthy();
  });
});
