# Campus cafeteria frontend

The React frontend provides login and public registration pages at `/login` and
`/register`. The forms currently validate input in the browser and show delayed
local demo responses; they do not call an authentication API or create accounts.

Public registration intentionally has no role selector. Staff access must be
assigned through an approved process and cannot be self-selected.

Run the frontend from this directory:

```sh
npm install
npm run dev
```
