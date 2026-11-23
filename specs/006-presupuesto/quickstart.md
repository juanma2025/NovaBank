# Quickstart: Presupuesto mensual por categorías

**Feature**: `006-presupuesto` · **Plan**: [plan.md](plan.md)

Requiere el entorno de las specs 001–005 (con `CARD_ENCRYPTION_KEY` en `.env`). Después de hacer
`pull`:

```powershell
npm install
docker compose up -d
npm run db:migrate
npm test
npm run test:e2e
```

No hay variables de entorno nuevas. Los correos de alerta se ven en Mailpit: `http://localhost:8025`.

## Validación manual

Con una cuenta que recargó $100.000 y tiene una tarjeta activa (spec 004):

### US1 — Topes y resumen

1. En `/presupuesto`, pon $20.000 a Comida → Comida muestra $0 de $20.000 (0 %).
2. Paga $5.000 en la Cafetería Central (`/tienda`) → Comida: $5.000 de $20.000 (25 %).
3. Transfiere $3.000 a otro estudiante → «Transferencias» muestra $3.000 (sin tope).

### US2 — Alertas

1. Paga $11.000 en el Restaurante La U → Comida llega a $16.000 (80 %): aparece «Te estás acercando
   a tu presupuesto de Comida», el inicio muestra el aviso y llega un correo a Mailpit.
2. Paga $5.000 más → $21.000 (105 %): «Superaste tu presupuesto de Comida» y otro correo.
3. Paga $1.000 más → sin alertas ni correos nuevos.

### US3 — Reclasificar e historial

1. En la lista de transferencias del mes, pasa la de $3.000 a «Otros» → «Transferencias» queda en $0 y
   «Otros» en $3.000.
2. Elige el mes anterior → muestra sus propios gastos y los topes que tenía.

### Base de datos

En la BD (`docker compose exec postgres psql -U nova nova`):

| Consulta | Resultado esperado |
| :--- | :--- |
| `SELECT category, threshold FROM budget_alerts;` | Una fila por umbral alcanzado: `food 80` y `food 100` |
| `SELECT template, status FROM email_outbox WHERE template = 'budget_alert';` | Dos correos `sent` |
