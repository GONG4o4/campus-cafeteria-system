# Super Admin

The `super_admin` role handles system administration: user accounts, staff
access, system-wide reports, audit logs, and approved settings. It uses the
same login and JWT as everyone else.

## Role permissions

| Feature | Student | Cafeteria Staff | Super Admin |
|---|---|---|---|
| Browse meals | Yes | Yes | Yes |
| Place customer orders | Yes | No | No |
| Manage menu | No | Yes | Yes |
| Update order status | No | Yes | No |
| View staff dashboard | No | Yes | Yes (read only) |
| System-wide reports, users, roles, account status, audit logs, settings | No | No | Yes |

## Setup

### 1. Run the migration

Run this once on your database after `database/schema.sql`. It is safe to run
again, and it does not change or delete existing accounts.

```powershell
psql -U postgres -d campus_cafeteria -f database/migrations/001_super_admin.sql
```

It does four things:

- adds `super_admin` to the allowed roles in `users.role_check`
- adds `users.is_active` (every existing account stays active)
- creates the `audit_logs` table
- creates the `system_settings` table with `allow_registration = true`

### 2. Create the first Super Admin

The script reads the details from environment variables, so the password is
never stored in code or in git. It refuses to run if an active super admin
already exists. The password must be 12 to 72 characters.

PowerShell, from the `backend` folder:

```powershell
$env:SUPER_ADMIN_EMAIL = "admin@yourschool.edu"
$env:SUPER_ADMIN_PASSWORD = "choose-a-long-password"
$env:SUPER_ADMIN_FNAME = "System"   # optional
$env:SUPER_ADMIN_LNAME = "Admin"    # optional
npm run create-super-admin

# clear the password from this terminal afterwards
Remove-Item Env:SUPER_ADMIN_PASSWORD
```

Then sign in on the normal login page. Super admins go to `/admin`.

## API

All routes are under `/api/admin`. Every route uses `authenticateToken`,
`requireRole("super_admin")`, and a database check that the account is still an
active super admin, so an old token from a demoted or deactivated admin does not
work.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/users?search=` | | Never returns password hashes |
| POST | `/staff` | `fname, lname, email, password` | Creates a `cafeteria_staff` account |
| PATCH | `/users/:id/role` | `role, current_password` | Role: `student`, `cafeteria_staff`, `super_admin` |
| PATCH | `/users/:id/status` | `is_active, current_password` | Activate / deactivate |
| GET | `/reports` | | User counts, orders by status, sales, last 7 days, top meals |
| GET | `/audit-logs?limit=` | | Newest first, limit 1 to 200 (default 50) |
| GET | `/settings` | | |
| PUT | `/settings` | `{ "allow_registration": true }` | Only approved settings are accepted |

### Safeguards

- Role and status changes need the admin to re-enter their password (`current_password`).
- An admin cannot change their own role or deactivate themselves, so nobody can promote themselves.
- The last active super admin cannot be demoted or deactivated (checked inside a transaction with row locks).
- IDs, roles, statuses, and request bodies are validated. Extra fields are rejected.
- Staff creation, role changes, activation/deactivation, settings changes, and the setup script are written to `audit_logs` (actor, action, target, details, time).

### Other changes

- Login returns `403` for deactivated accounts.
- The session check (`/api/test/protected`) returns `401` if the account was deactivated or its role changed, so the frontend signs that user out on the next page load.
- `POST /api/auth/register` returns `403` when `allow_registration` is off.
- Menu create/update/delete now also allow `super_admin`.
- `GET /api/staff/orders` now also allows `super_admin` (for the read-only staff dashboard). Updating order status is still staff only.

**Known limit:** other (non-admin) routes still trust the JWT until it expires
(1 hour). A deactivated student or staff member is blocked from logging in
again and from the admin API right away, but an already-issued token keeps
working on those routes until it expires.

## Tests

```powershell
cd backend
npm test
```

`backend/test/admin.test.js` covers allowed and forbidden access for every
role, validation errors, password confirmation, the self-change rules, the last
super admin rule, and audit logging.
