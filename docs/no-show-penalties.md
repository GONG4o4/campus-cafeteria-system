# No-Show Tracking and Ordering Restrictions

When a customer does not collect an order that is ready for pickup, cafeteria
staff can mark it as a **no-show**. The backend records it, counts the
customer's recent no-shows, and gives either a **warning** or a **temporary
ordering restriction**. All rules run on the backend. Nobody is charged money.

> **Policy values need owner approval.** The numbers in the migration
> (30 / 15 / 3 / 30 / 7) are placeholders. Confirm the real values with the
> project owner and change them with the SQL below. No code change needed.

## Setup

Run once, after `schema.sql` and migrations 001 and 002. Safe to run again.

```powershell
psql -U postgres -d campus_cafeteria -f database/migrations/003_no_show_penalties.sql
```

It:

- adds `no_show` to the allowed order statuses
- adds `orders.ready_at` (filled in for orders that are already `ready`)
- creates `no_show_policy`, `no_show_records` and `customer_restrictions`

## Policy configuration

All values live in the single row of `no_show_policy`.

| Column | Placeholder | Meaning |
|---|---|---|
| `pickup_window_minutes` | 30 | Time to collect after the order becomes ready |
| `grace_period_minutes` | 15 | Extra time after the pickup window before a no-show is allowed |
| `offense_threshold` | 3 | No-shows (inside the window below) that trigger a restriction |
| `offense_window_days` | 30 | Only no-shows from the last N days are counted |
| `restriction_days` | 7 | How long a restriction blocks new orders |

Change them, for example:

```sql
UPDATE no_show_policy
SET pickup_window_minutes = 20,
    grace_period_minutes = 10,
    offense_threshold = 3,
    offense_window_days = 30,
    restriction_days = 3,
    updated_at = CURRENT_TIMESTAMP
WHERE policy_id = 1;
```

## How it works

1. An order becomes `ready` and the backend saves `ready_at`.
2. After `ready_at + pickup_window_minutes + grace_period_minutes`, staff can
   mark it as a no-show. The check uses the database clock, not the browser.
3. In one transaction the backend:
   - changes the order status from `ready` to `no_show`
   - saves a `no_show_records` row (customer, order, staff member, time, result)
   - counts the customer's no-shows from the last `offense_window_days`
   - below `offense_threshold` the result is a **warning**; at or above it,
     a **restriction** is created for `restriction_days`
   - writes an `order_marked_no_show` row to `audit_logs`
4. While a restriction is `active` and `ends_at` is in the future,
   `POST /api/orders` returns `403`. After `ends_at` it stops blocking.
   No cleanup job is needed.

Each no-show that reaches the threshold creates its own restriction. So a
customer who misses another pickup while still over the threshold gets a new
restriction starting from that moment.

Only `ready` orders can be marked. `pending`, `preparing`, `picked_up`,
`cancelled` and `no_show` orders are rejected. One order can create at most
one no-show record. This is enforced with a row lock, a `ready` -> `no_show`
status check, and `UNIQUE (order_id)` on `no_show_records`.

## API

### `POST /api/staff/orders/:id/no-show`, `cafeteria_staff` only

No request body. Anything sent in the body is rejected with `400`.

| Status | When |
|---|---|
| 200 | Recorded. Returns `order`, `no_show` and `restriction` (`null` for a warning) |
| 400 | Invalid order ID or a body was sent |
| 401 / 403 | Not logged in / not cafeteria staff (students and super admins get 403) |
| 404 | Order not found |
| 409 | Not `ready`, already a no-show, or deadline/grace period not over (`no_show_after` included) |

```json
{
  "message": "Order marked as a no-show. The customer is temporarily restricted from ordering.",
  "order": { "order_id": 5, "queue_number": 5, "status": "no_show" },
  "no_show": {
    "no_show_id": 3, "order_id": 5, "customer_id": 1, "recorded_by": 50,
    "recorded_at": "2026-11-22T10:25:05", "offense_count": 3,
    "offense_threshold": 3, "offense_window_days": 30, "policy_result": "restricted"
  },
  "restriction": {
    "restriction_id": 1, "reason": "3 uncollected orders within 30 days",
    "starts_at": "2026-11-22T10:25:05", "ends_at": "2026-11-29T10:25:05"
  }
}
```

### `GET /api/staff/orders` (existing, new fields)

Each order now also has `ready_at` and `can_mark_no_show` (true when the
order is `ready` and the grace period is over). The staff UI can use this
flag to show the "Not collected" button.

### `GET /api/staff/customers/:id/no-shows`, `cafeteria_staff` and `super_admin`

### `GET /api/orders/penalty-status`, `student`, own account only

Both return:

```json
{
  "recent_no_show_count": 3,
  "offense_threshold": 3,
  "offense_window_days": 30,
  "active_restriction": { "restriction_id": 1, "reason": "...", "starts_at": "...", "ends_at": "..." },
  "history": [
    { "no_show_id": 3, "order_id": 5, "queue_number": 5, "order_date": "2026-11-22",
      "recorded_at": "...", "offense_count": 3, "policy_result": "restricted",
      "counts_toward_policy": true }
  ]
}
```

### `POST /api/orders` (existing, new response)

A restricted customer gets:

```json
{
  "message": "Your account cannot place orders until 2026-11-29T10:25:05 because of uncollected orders.",
  "code": "ORDERING_RESTRICTED",
  "restriction": { "restriction_id": 1, "reason": "...", "starts_at": "...", "ends_at": "2026-11-29T10:25:05" }
}
```

## Security notes

- Only `cafeteria_staff` can record a no-show. Customers cannot mark orders.
- There are no endpoints to edit or delete no-show records or restrictions.
- Students only ever see their own history (`penalty-status` uses the JWT user).
- Every no-show is in `audit_logs` with the staff member, customer, result and restriction.

## Tests

`npm test` in `backend/` runs `test/noShow.test.js` (deadline, grace period,
invalid states, duplicates, threshold, roles) and new cases in
`test/orders.test.js` (active, expired and other customers' restrictions).
These tests mock the database. The SQL was also checked end to end against
a real PostgreSQL 18 database, including concurrent duplicate requests.
