# Quickstart: Transferencias entre estudiantes

**Feature**: `003-transferencias` · **Plan**: [plan.md](plan.md)

Requiere el entorno de las specs 001 y 002. Después de hacer `pull`:

```powershell
npm install
docker compose up -d
npm run db:migrate
npm test
npm run test:e2e
```

Variables nuevas en `.env`, opcionales porque estos son los valores por defecto:
`TRANSFER_MIN_AMOUNT=1000`, `TRANSFER_MAX_AMOUNT=500000`, `TRANSFER_DAILY_LIMIT=1000000` y
`TRANSFER_REAUTH_THRESHOLD=200000`.

## Validación manual

Prepara dos cuentas, **A** y **B**, en navegadores distintos. A recarga $300.000 (spec 002).

### US2 — Alias

1. B entra a `/perfil` y asigna `@b.prueba` → queda guardado.
2. A intenta asignar `@b.prueba` → «No está disponible».
3. B escribe `.b` → Nova le explica la regla del formato antes de guardar.

### US1 — Enviar

1. A entra a `/enviar` → escribe `@B.Prueba` → ve el nombre parcial de B y su correo enmascarado.
2. Monto `15.000` y nota «almuerzo» → confirma.
   - A queda en $285.000 y ve «Transferencia a B…» con «−$15.000» y la nota.
   - B ve «Transferencia de A…» con «+$15.000» y la nota.
3. A intenta enviarse a sí misma → mensaje claro.
4. A intenta enviar $250.000 → se le pide la contraseña. Con una incorrecta, no se envía nada; con la
   correcta, se envía.
5. A intenta enviar más de lo que tiene → «Saldo insuficiente», con su disponible.
6. Doble clic rápido en «Confirmar» → se aplica una sola transferencia.

### Libro contable

En la BD (`docker compose exec postgres psql -U nova nova`):

| Consulta | Resultado esperado |
| :--- | :--- |
| `SELECT SUM(amount) FROM ledger_entries;` | `0` |
| `SELECT description, amount FROM ledger_entries WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE type = 'transfer');` | Un asiento con «Transferencia a …» negativo y otro con «Transferencia de …» positivo |
