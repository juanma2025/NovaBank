# Quickstart: Gastos compartidos

**Feature**: `007-gastos-compartidos` · **Plan**: [plan.md](plan.md)

Requiere el entorno de las specs 001–006. Después de hacer `pull`:

```powershell
npm install
docker compose up -d
npm run db:migrate
npm test
npm run build
npm run test:e2e
```

No hay variables de entorno nuevas. Los correos se ven en Mailpit: `http://localhost:8025`.

## Validación manual

Prepara tres cuentas en navegadores distintos: **Ana**, **Juan** y **Laura**. Juan y Laura recargan
$50.000 cada uno (spec 002).

### US1 — Dividir y pagar

1. Ana entra a `/compartidos/nueva`: «Cena de cumpleaños», total `90.000`, agrega a Juan y a Laura →
   Nova propone $30.000 para cada uno y $30.000 para Ana. Crea la división.
2. Juan y Laura reciben un correo en Mailpit y ven la solicitud en `/compartidos`.
3. Juan abre la división y pulsa «Pagar mi parte» → su saldo baja a $20.000, el de Ana sube $30.000 y
   la parte de Juan queda «Pagada». Ana recibe un correo.
4. En el historial de Juan aparece «Transferencia a Ana P. G.» con la nota «Gasto compartido: Cena de
   cumpleaños».
5. Doble clic rápido en «Pagar mi parte» (con Laura) → se transfiere una sola vez.

### US2 — Seguir y gestionar

1. Ana crea otra división con Juan y Laura. Marca la parte de Laura como pagada por fuera → no cambia
   ningún saldo.
2. Juan rechaza su parte → queda «Rechazada» y la división pasa a «Completada».
3. En una tercera división, Ana envía un recordatorio a Juan → llega un correo; un segundo
   recordatorio → «Podrás enviar otro recordatorio a las …».
4. Ana cancela esa división → las partes pendientes quedan canceladas y Juan ya no puede pagar.
5. En el inicio, Ana ve «Te deben» y Juan «Debes» con los totales pendientes.

### Base de datos

En la BD (`docker compose exec postgres psql -U nova nova`):

| Consulta | Resultado esperado |
| :--- | :--- |
| `SELECT status, transfer_transaction_id IS NOT NULL FROM split_shares;` | Las partes `paid` tienen transferencia; ninguna otra |
| `SELECT SUM(amount) FROM ledger_entries;` | `0` |
