# Campus cafeteria frontend

The React frontend provides login and public registration pages at `/login` and
`/register`. The forms currently validate input in the browser and show delayed
local demo responses; they do not call an authentication API or create accounts.

Public registration intentionally has no role selector. Staff access must be
assigned through an approved process and cannot be self-selected.

After signing in, `/home` shows the student menu, `/cart` and `/checkout` provide
a session-only ordering demo, `/confirmation` shows the last demo order, and
`/orders` shows sample history. The menu loads from the backend's
`GET /api/menu` endpoint. Checkout does not create a real order or save data.
Screenshots of the menu at mobile, tablet, and desktop widths, plus the cart,
checkout, confirmation, and order history, are in `screenshots/`.

Run the frontend from this directory:

```sh
npm install
npm run dev
```
