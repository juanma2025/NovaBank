import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AuthLayout } from '../src/components/AuthLayout.tsx';
import { CodeInput } from '../src/features/auth/components/CodeInput.tsx';
import { InactivityDialog } from '../src/features/auth/components/InactivityDialog.tsx';
import { PasswordRules } from '../src/features/auth/components/PasswordRules.tsx';

describe('Accesibilidad WCAG 2.1 AA (T083)', () => {
  it('AuthLayout expone landmarks semánticos header, main y footer', () => {
    render(
      <MemoryRouter>
        <AuthLayout footer={<p>Pie de enlace</p>}>
          <h1>Título principal</h1>
        </AuthLayout>
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('CodeInput preserva el foco del teclado cuando cambia errorKey (no desmonta los inputs)', () => {
    const { rerender } = render(
      <CodeInput value="123456" onChange={vi.fn()} error={undefined} errorKey={0} />,
    );

    const firstDigit = screen.getByLabelText(/dígito 1 de 6/i);
    firstDigit.focus();
    expect(document.activeElement).toBe(firstDigit);

    rerender(
      <CodeInput value="123456" onChange={vi.fn()} error="El código no es válido." errorKey={1} />,
    );

    expect(document.activeElement).toBe(firstDigit);
    expect(screen.getByRole('alert').textContent).toContain('El código no es válido.');
  });

  it('PasswordRules anuncia el estado cumplido o no cumplido para lectores de pantalla', () => {
    render(<PasswordRules password="corta" email="ana@ucc.edu.co" touched />);

    expect(screen.getByText(/al menos 10 caracteres/i).textContent).toContain('No cumplida:');
    expect(screen.getByText(/máximo 128 caracteres/i).textContent).toContain('Cumplida:');
  });

  it('InactivityDialog atrapa el foco con Tab/Shift+Tab y lo restaura al cerrar', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <InactivityDialog
        open
        secondsLeft={60}
        isRefreshing={false}
        onStayConnected={vi.fn()}
        onLogoutNow={vi.fn()}
      />,
    );

    const stayButton = screen.getByRole('button', { name: /seguir conectado/i });
    const logoutButton = screen.getByRole('button', { name: /cerrar sesión/i });
    expect(document.activeElement).toBe(stayButton);

    // Shift+Tab desde el primer botón vuelve al último botón del modal
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(logoutButton);

    // Tab desde el último botón vuelve al primero
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(stayButton);

    rerender(
      <InactivityDialog
        open={false}
        secondsLeft={60}
        isRefreshing={false}
        onStayConnected={vi.fn()}
        onLogoutNow={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
