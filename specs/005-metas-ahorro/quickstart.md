# Quickstart: Metas de ahorro

**Feature**: `005-metas-ahorro` · **Plan**: [plan.md](plan.md)

Requiere el entorno de las specs 001–004. Después de hacer `pull`:

```powershell
npm install
docker compose up -d
npm run db:migrate
npm test
npm run test:e2e
```

Variables opcionales (estos son los valores por defecto): `SAVINGS_MIN_AMOUNT=1000`,
`SAVINGS_MAX_AMOUNT=2000000` y `SAVINGS_DAILY_LIMIT=5000000`.

## Validación manual

Con una cuenta que recargó $100.000 (spec 002):

### US1 — Crear y aportar

1. En `/metas`, «Nueva meta»: «Viaje a Santa Marta», $600.000, con una fecha dentro de 6 meses →
   aparece con $0 y 0 %.
2. Aporta $50.000 → la meta queda en $50.000 (8 %), el inicio muestra $50.000 disponibles y el
   movimiento «Aporte a Viaje a Santa Marta» con «−$50.000». El detalle muestra el ahorro sugerido por
   mes.
3. Intenta aportar $60.000 → «Saldo insuficiente», con $50.000 disponibles.
4. Crea 4 metas más; la sexta → «Alcanzaste el máximo de 5 metas».

### US2 — Retirar

1. Retira $20.000 → la meta queda en $30.000 y el disponible en $70.000.
2. Intenta retirar $40.000 → rechazado, con $30.000 en la meta.
3. Intenta transferir o pagar más de $70.000 → rechazado: el dinero de la meta no está disponible.

### US3 — Administrar y cerrar

1. Baja el objetivo a $25.000 → la meta aparece «Cumplida».
2. Ciérrala → Nova muestra que volverán $30.000; al confirmar, el disponible sube a $100.000 y la meta
   queda «Cerrada» al final de la lista, sin acciones.

### Libro contable

En la BD (`docker compose exec postgres psql -U nova nova`):

| Consulta | Resultado esperado |
| :--- | :--- |
| `SELECT SUM(amount) FROM ledger_entries;` | `0` |
| `SELECT a.balance FROM savings_goals g JOIN accounts a ON a.id = g.account_id;` | El saldo de cada meta; ninguno negativo; `0` en las cerradas |
