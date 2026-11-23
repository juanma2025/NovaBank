# Quickstart: Cuenta en COP, libro contable y recarga simulada

**Feature**: `002-cuentas-ledger` · **Plan**: [plan.md](plan.md)

Requiere el entorno de la spec 001 (ver [README](../../README.md#primeros-pasos)).

## 1. Preparar

```powershell
git pull
npm install
docker compose up -d
npm run db:migrate          # aplica la migración de cuentas y libro contable
```

En `.env`, opcional porque estos son los valores por defecto:

```text
TOPUP_MIN_AMOUNT=1000
TOPUP_MAX_AMOUNT=500000
TOPUP_DAILY_LIMIT=2000000
```

## 2. Pruebas automáticas

```powershell
npm run lint
npm run typecheck
npm test          # incluye concurrencia, invariantes del libro y contratos 001 + 002
npm run test:e2e
```

## 3. Validación manual por historia

Levanta `npm run dev:backend` y `npm run dev:frontend`, e inicia sesión con una cuenta de la spec
001.

### US1 — Inicio (P1)

1. Con una cuenta nueva, `/inicio` muestra:
   - el saldo «$0»;
   - «Aún no tienes movimientos» con el botón «Recargar»;
   - la tarjeta «Muy pronto».
2. Pulsa ocultar saldo → «••••••». Recarga la página → sigue oculto. Pulsa mostrar.
3. Pulsa la tarjeta «Muy pronto» → aparece un mensaje informativo. En las herramientas del
   navegador (Network) no se hace ninguna llamada a la API.

### US2 — Recarga (P2)

1. «Recargar» → escribe `50.000` → «Continuar» → el resumen dice «dinero de demostración» →
   «Confirmar».
   - El saldo pasa a «$50.000».
   - «Recarga simulada +$50.000» queda como primer movimiento.
2. Escribe `500` → aparece el aviso del mínimo de $1.000. Escribe `600.000` → aparece el aviso del
   máximo de $500.000.
3. Recarga $500.000 cuatro veces en el día → la quinta se rechaza con «puedes recargar hasta $0 hoy».
4. Doble clic rápido en «Confirmar» → se aplica una sola recarga.

### US3 — Historial (P3)

1. Con más de 20 movimientos, «Ver todos» → aparecen 20 → «Cargar más» → siguen los siguientes, sin
   repetidos.

## 4. Comprobaciones del libro contable (SC-003)

En la BD (`docker compose exec postgres psql -U nova nova`):

| Consulta | Resultado esperado |
| :--- | :--- |
| `SELECT SUM(amount) FROM ledger_entries;` | `0` |
| `SELECT a.id FROM accounts a WHERE a.kind = 'student' AND a.balance <> (SELECT COALESCE(SUM(e.amount), 0) FROM ledger_entries e WHERE e.account_id = a.id);` | Ninguna fila |
| `UPDATE ledger_entries SET amount = 1;` | Error del trigger de inmutabilidad |
| `UPDATE ledger_transactions SET status = 'pending' WHERE status = 'completed';` | Error de la máquina de estados |
