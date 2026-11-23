import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AmountInput } from '../src/features/topups/components/AmountInput.tsx';

function ControlledAmountInput({
  onParsedChange,
  error,
}: {
  onParsedChange: (amount: number | null, raw: string) => void;
  error?: string;
}) {
  const [raw, setRaw] = useState('');
  return (
    <AmountInput
      label="Monto a recargar"
      value={raw}
      error={error}
      onValueChange={(parsed, nextRaw) => {
        setRaw(nextRaw);
        onParsedChange(parsed, nextRaw);
      }}
    />
  );
}

describe('AmountInput (US2 · T031)', () => {
  it('formatea con separadores de miles mientras se escribe y expone inputMode numeric', async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();

    render(<ControlledAmountInput onParsedChange={onParsed} />);

    const input = screen.getByLabelText(/monto a recargar/i) as HTMLInputElement;
    expect(input.getAttribute('inputMode')).toBe('numeric');

    await user.type(input, '50000');

    expect(input.value).toBe('50.000');
    expect(onParsed).toHaveBeenLastCalledWith(50_000, '50.000');
  });

  it('interpreta montos pegados con signo $ y separadores de miles', async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();

    render(<ControlledAmountInput onParsedChange={onParsed} />);

    const input = screen.getByLabelText(/monto a recargar/i) as HTMLInputElement;
    await user.click(input);
    await user.paste('$ 125.000');

    expect(input.value).toBe('125.000');
    expect(onParsed).toHaveBeenLastCalledWith(125_000, '125.000');
  });

  it('devuelve null ante decimales o letras y asocia el error accesible', async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();

    render(
      <ControlledAmountInput
        onParsedChange={onParsed}
        error="Ingresa un monto entero en pesos colombianos."
      />,
    );

    const input = screen.getByLabelText(/monto a recargar/i) as HTMLInputElement;
    await user.type(input, '50,5');

    expect(onParsed).toHaveBeenLastCalledWith(null, '50,5');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorEl = screen.getByRole('alert');
    expect(errorEl.textContent).toContain('monto entero');
    expect(input.getAttribute('aria-describedby')).toContain(errorEl.id);
  });
});
