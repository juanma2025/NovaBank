# Quickstart: Tarjeta virtual

**Feature**: `004-tarjeta-virtual` · **Plan**: [plan.md](plan.md)

Requiere el entorno de las specs 001–003. Después de hacer `pull`:

1. Agrega a tu `.env` la clave de cifrado de tarjetas (es obligatoria). Genera una con:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   y guárdala como `CARD_ENCRYPTION_KEY=<los 64 caracteres>`.
2. Ejecuta:

   ```powershell
   npm install
   docker compose up -d
   npm run db:migrate
   npm test
   npm run test:e2e
   ```

Variables opcionales (estos son los valores por defecto): `CARD_PAYMENT_MIN_AMOUNT=1000`,
`CARD_PAYMENT_MAX_AMOUNT=500000` y `CARD_PAYMENT_DAILY_LIMIT=1000000`.

## Validación manual

Con una cuenta que recargó $100.000 (spec 002):

### US1 — Emitir y congelar

1. En `/tarjetas`, «Nueva tarjeta» con el nombre «Compras» → aparece activa, con •••• y 4 dígitos.
2. Congélala → «Congelada». Descongélala → «Activa».

### US2 — Ver datos

1. En el detalle, «Ver datos» con una contraseña incorrecta → no muestra nada.
2. Con la correcta → número de 16 dígitos que empieza por 9, MM/AA y CVV. Al minuto se ocultan.

### US3 — Pagar

1. En `/tienda`, «Cafetería Central», $12.000, con los datos de la tarjeta → aprobado; el saldo baja
   a $88.000 y en el inicio aparece «Compra en Cafetería Central · •••• NNNN» con «−$12.000».
2. Repite con un CVV equivocado → «Pago rechazado» (sin decir qué dato falló).
3. Congela la tarjeta y repite el pago → «La tarjeta no está activa»; el saldo no cambia.

### US4 — Varias tarjetas

1. Emite dos tarjetas más; la cuarta → «Alcanzaste el máximo de 3 tarjetas».
2. Cancela una (con confirmación) → «Cancelada»; ahora sí puedes emitir otra, con otro número.

### Datos protegidos

En la BD (`docker compose exec postgres psql -U nova nova`):

| Consulta | Resultado esperado |
| :--- | :--- |
| `SELECT last4, pan_hash, length(pan_encrypted) FROM cards;` | 4 dígitos, un hash de 64 caracteres y bytes cifrados; ninguna columna con el número en claro ni el CVV |
| `SELECT SUM(amount) FROM ledger_entries;` | `0` |
