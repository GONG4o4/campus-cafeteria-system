# Same-day scheduled pickup (issue #96)

Customers can choose **ASAP** (the normal queue) or **Schedule for later today**
at checkout. Both kinds of orders use the same checkout, HitPay payment,
shared queue numbers and staff order queue. There is no second queue.

## Setup

Run the migration after `008`:

```powershell
psql -U postgres -d campus_cafeteria -f database/migrations/009_scheduled_pickup.sql
```

Existing orders become `asap` with no scheduled time, so they keep working.

## Settings (`pickup_settings`, one row)

| Column | First-release value | Meaning |
|---|---|---|
| `open_time` | `07:00` | First pickup time (Asia/Manila) |
| `close_time` | `17:00` | Cafeteria closes. The last pickup time is `close_time - slot_minutes` (4:45 PM) |
| `slot_minutes` | `15` | Pickup times are offered every 15 minutes |
| `slot_capacity` | `10` | Max scheduled orders per pickup time |
| `prep_lead_minutes` | `20` | Staff should start preparing 20 minutes before pickup |
| `booking_buffer_minutes` | `10` | Extra time, so the earliest pickup is now + 20 + 10 = 30 minutes |

These values were agreed for the first release. Change them with an `UPDATE`;
no code change is needed:

```sql
UPDATE pickup_settings SET slot_capacity = 12 WHERE setting_id = 1;
```

## Rules (checked by the backend, never trusted from the browser)

- **Same day only.** The browser sends only a time like `"10:30"`. The backend
  turns it into that time **today in Asia/Manila** using PostgreSQL, so the
  server computer's time zone does not matter.
- **Inside cafeteria hours** and **on a slot** (`07:00`, `07:15`, ...).
- **Far enough ahead:** at least `prep_lead_minutes + booking_buffer_minutes` from now.
  Past times are rejected too.
- **Not full:** a slot holds at most `slot_capacity` orders. An order holds a place
  if it is not cancelled and is either paid, or unpaid but placed in the last
  60 minutes (abandoned checkouts free their place). A per-slot lock
  (`pg_advisory_xact_lock`) inside the order transaction makes two customers
  booking the last place at the same moment wait for each other, so only one gets it.
- Menu availability, prices, the no-show restriction and the unpaid-order limit
  are checked exactly as for ASAP orders.
- Cancelling is unchanged: customers can cancel only while the order is `pending`.
  A cancelled order frees its place in the slot.
- ASAP ordering is unchanged and is not limited by these hours.

## API

### `GET /api/orders/pickup-slots` (student)

Pickup times still available **today**. Times that are too soon, already passed
or outside hours are not listed.

```json
{
  "date": "2026-11-28",
  "open_time": "07:00",
  "close_time": "17:00",
  "slot_minutes": 15,
  "slot_capacity": 10,
  "slots": [
    { "time": "10:30", "label": "10:30 AM", "remaining": 7, "full": false },
    { "time": "10:45", "label": "10:45 AM", "remaining": 0, "full": true }
  ]
}
```

### `POST /api/orders` (student) – new optional `pickup` field

```json
{ "items": [...], "acknowledge_no_show_policy": true, "pickup": { "type": "scheduled", "time": "10:30" } }
```

- `pickup` left out, or `{ "type": "asap" }` → normal ASAP order (older clients still work).
- Errors:
  - `400 INVALID_PICKUP` – type is not `asap` or `scheduled`
  - `400 INVALID_PICKUP_TIME` – bad format, outside hours, not on a slot, too soon or passed
  - `409 PICKUP_SLOT_FULL` – "The 10:30 AM pickup time is full. Please choose another time."

### Order data

Customer order history (`GET /api/orders`, `GET /api/orders/:id`) and the staff
queue (`GET /api/staff/orders`) now include:

| Field | Example | Notes |
|---|---|---|
| `pickup_type` | `"scheduled"` | or `"asap"` |
| `scheduled_pickup_at` | `"2026-11-28T10:30:00"` | Asia/Manila time, `null` for ASAP |

The staff queue also includes:

| Field | Meaning |
|---|---|
| `prepare_from` | Pickup time minus `prep_lead_minutes` (Asia/Manila) |
| `prep_status` | `upcoming`, `prepare_now` or `late` for scheduled orders that are still `pending`/`preparing`; `null` otherwise. Decided by the server clock. |

## Staff queue

- Every card shows **ASAP** or **Scheduled · pickup HH:MM**.
- Scheduled orders that are not ready yet show "Start preparing at …",
  "Prepare now …" or "Late …".
- A banner shows how many scheduled orders need preparing now or are late, with a
  **Scheduled pickup** filter. Scheduled orders also stay in the normal views.
- Orders are **never** marked Ready automatically. Staff still move them through
  `pending → preparing → ready → picked up`.

## Pickup deadline and no-show

The pickup timer still starts when staff mark the order **Ready**. For a scheduled
order finished **before** the customer's chosen time, the timer starts at the
**scheduled time** instead (the later of the two). A student in class is never
penalised before the time they chose. Pending and preparing orders can never
become no-shows. The pickup window and grace period still come from
`no_show_policy` (one source of truth).

## Still to decide with the project owner

- **Policy values:** the issue proposes a 15-minute pickup window plus 5-minute grace.
  The database still has 30 + 15. They were not changed here.
- **Delayed / cannot fulfil:** staff currently see "Late" on the card. A special
  staff action and a message to the customer were not added, because the issue says
  to agree on them first.
- **Ready notification:** the project has no push or email notifications. The order
  status is visible and refreshable in Order history, the same as ASAP orders.

## How it was checked

Automated test files are not used in this course, so the feature was checked by
running it against a real PostgreSQL database (27 checks, all passed):

- Past time, after closing, not on a slot, bad text and unknown type are all rejected with clear messages.
- A valid scheduled time and an ASAP order with no `pickup` field both pass every check.
- A full slot is rejected, the slot list shows it as full, and a cancelled order frees its place.
- Two customers booking the last place at the same moment: exactly one gets it.
- The staff view shows the type and time, with `upcoming`, `prepare_now` and `late` at the right times.
- A scheduled order marked Ready early cannot become a no-show before its pickup time.
  ASAP orders behave as before. Pending orders can never be no-shows.
- A failed payment leaves no half-saved order.
- Times are stored and shown in Asia/Manila. The test database's own time zone
  setting is `Asia/Kuala_Lumpur` (same offset), so every query names
  `Asia/Manila` explicitly instead of relying on the database or server setting.
