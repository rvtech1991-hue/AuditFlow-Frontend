# Auth & Authorization — Step-by-Step Testing Guide

A first-time, hands-on walkthrough of every endpoint in the Auth module (`AuthController`) plus the
role-based authorization that every other controller relies on. Each test gives you the exact
request, the expected HTTP response, and the exact SQL to run afterward to see what changed in the
database. Use this alongside `postman/AuditFlow.postman_collection.json` (the `Auth` folder covers
every endpoint here) and `ArchitectureFlow.md` §5.1 if you need the underlying code.

## 0. Prerequisites

1. **API running locally**: `dotnet run --project src/AuditFlow.API` (default `http://localhost:5298` —
   confirm against `src/AuditFlow.API/Properties/launchSettings.json` if different). Check
   `GET /health` returns `Healthy` before starting.
2. **Database migrated**: `dotnet ef database update --project src/AuditFlow.Infrastructure --startup-project src/AuditFlow.API`.
3. **A way to run SQL**: this guide uses `sqlcmd`, e.g.:
   ```
   sqlcmd -S localhost -d AuditFlow -E -C -Q "<query>"
   ```
   SSMS/Azure Data Studio work identically — just paste the query.
4. **A way to call the API**: `curl` (used throughout this guide) or the Postman collection
   (`postman/AuditFlow.postman_collection.json` + `AuditFlow.postman_environment.json`). Postman's
   `Auth > Login` request auto-saves `accessToken`/`refreshToken`/`userId` as collection variables, so
   if you're using Postman you can skip the manual `TOKEN=$(...)` extraction shown below.
5. **Dev email pickup folder**: with `Email:Provider = "Development"` (the default in
   `appsettings.json`), every email the app "sends" is written as an `.html` file to
   `C:\AuditFlow\EmailPickup\` instead of actually being delivered. You'll open files from here
   during the password-reset and invitation tests.

## 1. Seed accounts (one per role, already in your local DB)

| Email | Password | Role | Status | TenantId | CompanyId |
|---|---|---|---|---|---|
| `platformadmin@seed.test` | `<pwd>` | PlatformAdmin | Active | *(none — platform-level)* | *(none)* |
| `auditor@seed.test` | `<pwd>` | Auditor | Active | `295416cb-7528-4fd7-b2be-8c6fc2ffc93f` | *(none — Auditor uses `UserCompanyMappings`, not a home company)* |
| `companyadmin@seed.test` | `<pwd>` | CompanyAdmin | Active | `295416cb-7528-4fd7-b2be-8c6fc2ffc93f` | `6dfa5b92-8546-4e3d-a417-48e9bf861552` |
| `employee@seed.test` | `<pwd>` | Employee | Active | `295416cb-7528-4fd7-b2be-8c6fc2ffc93f` | `6dfa5b92-8546-4e3d-a417-48e9bf861552` |

> All four passwords were just synchronized to `<pwd>` (via the admin reset-password endpoint)
> so this guide works end-to-end against your current local DB. If you'd set different passwords for
> these seed accounts before, they've been overwritten — reset them again afterward if you need the
> old values back.

Get the exact IDs any time with:
```sql
SELECT Id, Email, FullName, Role, Status, TenantId, CompanyId, SubCompanyId, MfaEnabled FROM Users ORDER BY Role;
```
(`Role`: 1=PlatformAdmin, 2=Auditor, 3=CompanyAdmin, 4=Employee. `Status`: 1=Invited, 2=Active, 3=Deactivated.)

## 2. Test Suite A — Login (happy & unhappy paths)

### A1. Successful login

```bash
curl -s -X POST http://localhost:5298/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"auditor@seed.test","password":"<pwd>","rememberMe":true}'
```

**Expected response** (`200`):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "x/HR3edO...",
    "expiresAt": "2026-07-24T11:24:33Z",
    "user": { "id": "...", "email": "auditor@seed.test", "role": 2, "status": 2, "mfaEnabled": false, ... },
    "requiresMfa": false
  },
  "statusCode": 200
}
```
`expiresAt` should be ~60 minutes from now (`Jwt:ExpiryMinutes` in `appsettings.json`).

**DB check:**
```sql
-- 1. A new active row appears in RefreshTokens for this user
SELECT TOP 1 Id, UserId, ExpiresAt, RevokedAt, CreatedAt FROM RefreshTokens
WHERE UserId = '06ae13f1-b5dd-4c40-7099-08dee90407d5' ORDER BY CreatedAt DESC;
-- RevokedAt should be NULL, ExpiresAt ~7 days out (rememberMe:true)

-- 2. Users.LastLoginAt was just stamped
SELECT LastLoginAt FROM Users WHERE Email = 'auditor@seed.test';

-- 3. A Login audit entry was written
SELECT TOP 1 Action, MetadataJson, CreatedAt FROM AuditLogs
WHERE UserId = '06ae13f1-b5dd-4c40-7099-08dee90407d5' AND Action = 17 ORDER BY CreatedAt DESC;
-- Action=17 is AuditAction.Login; MetadataJson should contain {"success":true}
```

### A2. Wrong password

```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:5298/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"auditor@seed.test","password":"<wrong-pwd>"}'
```

**Expected:** `401`, `{"success":false,"errorCode":"INVALID_CREDENTIALS",...}`.

**DB check:**
```sql
SELECT AccessFailedCount FROM Users WHERE Email = 'auditor@seed.test'; -- incremented by 1
SELECT TOP 1 Action, MetadataJson FROM AuditLogs WHERE UserId = '06ae13f1-b5dd-4c40-7099-08dee90407d5'
  AND Action = 17 ORDER BY CreatedAt DESC; -- MetadataJson: {"success":false}
```
Log in successfully once afterward (A1) to reset `AccessFailedCount` back to 0 — a successful login
always resets it.

### A3. Account lockout (⚠️ optional — locks the account for 15 minutes)

Identity is configured for `MaxFailedAccessAttempts = 5`, `DefaultLockoutTimeSpan = 15 minutes`
(`Infrastructure/DependencyInjection.cs`). Repeat A2 five times in a row and the sixth attempt (even
with the *correct* password) returns:
```json
{"success": false, "errorCode": "ACCOUNT_LOCKED", "statusCode": 423}
```
Only try this against a seed account you don't need for the next 15 minutes — there's no manual unlock
endpoint, you just have to wait it out (or directly clear `AspNetUsers.LockoutEnd`/`AccessFailedCount`
via SQL if you don't want to wait).

### A4. Non-existent account / inactive account

```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:5298/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"nobody@seed.test","password":"x"}'
```
**Expected:** `401 INVALID_CREDENTIALS` — deliberately the *same* error/code as a wrong password, so
this endpoint can't be used to enumerate which emails have accounts.

## 3. Test Suite B — Token lifecycle (JWT + refresh token rotation)

### B1. Decode the access token

Paste the `accessToken` from A1 into [jwt.io](https://jwt.io) (or any local decoder) and check the
payload claims:

| Claim | Meaning |
|---|---|
| `nameidentifier` (full URI: `.../claims/nameidentifier`) | the user's `Id` |
| `tenant_id` | `Users.TenantId` (or `Guid.Empty` for PlatformAdmin) |
| `role` (full URI: `.../claims/role`) | one or more role names — sourced from `AspNetUserRoles`, falling back to `Users.Role` only if that's empty (see `DatabaseStructure.md` §7) |
| `company_id` / `sub_company_id` | present only if `Users.CompanyId`/`SubCompanyId` are set (absent for Auditor/PlatformAdmin) |
| `mapped_company_id` | zero, one, or repeated — one per row in `UserCompanyMappings` for this user (populated for Auditors mapped across multiple companies) |
| `exp` | matches the `expiresAt` from the login response |

No `JsonStringEnumConverter` is configured anywhere, but note the JWT's `role` claim is the **string**
role name (e.g. `"Auditor"`), not the integer — that's what `[Authorize(Roles = "Auditor")]` compares
against.

### B2. Use the token to call a protected endpoint

```bash
TOKEN="<paste accessToken>"
curl -s -w "\nstatus: %{http_code}\n" http://localhost:5298/api/v1/users/me -H "Authorization: Bearer $TOKEN"
```
**Expected:** `200`, your own profile back (`ApiResponse<UserProfileResponse>`).

### B3. Refresh the token

```bash
REFRESH="<paste refreshToken from A1>"
curl -s -X POST http://localhost:5298/api/v1/auth/refresh \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}"
```
**Expected:** `200`, a **new** `accessToken` + `refreshToken` pair.

**DB check — this is the important one, rotation should be visible:**
```sql
SELECT Id, ExpiresAt, RevokedAt, ReplacedByTokenHash FROM RefreshTokens
WHERE UserId = '06ae13f1-b5dd-4c40-7099-08dee90407d5' ORDER BY CreatedAt DESC;
```
You should see: the **old** row now has `RevokedAt` set and `ReplacedByTokenHash` pointing at the new
token's hash, and a **new** row exists with `RevokedAt = NULL`. The raw token value is never stored —
only `TokenHash` (SHA-256) — so you can't correlate rows to the actual token strings via SQL, only by
recency/chain.

### B4. Refresh-token reuse detection

Take the **old, now-revoked** refresh token from B3 and try to use it again:
```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:5298/api/v1/auth/refresh \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}"
```
**Expected:** `401`, `errorCode: "REFRESH_TOKEN_REUSED"`. This simulates a stolen/replayed token being
presented after the legitimate rotation already happened.

**DB check:**
```sql
SELECT RevokedAt FROM RefreshTokens WHERE UserId = '06ae13f1-b5dd-4c40-7099-08dee90407d5' AND RevokedAt IS NULL;
```
**Expected: zero rows.** Reuse detection revokes *every* active session for that user, not just the
one being replayed — you'll need to log in again (A1) to get a usable token for the rest of this guide.

### B5. Logout

Log in fresh (A1), then:
```bash
curl -s -X POST http://localhost:5298/api/v1/auth/logout -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}"
```
**Expected:** `200`, `"Logged out successfully"`.

**DB check:** that one `RefreshTokens` row now has `RevokedAt` set (only that session — Logout doesn't
touch the user's other active sessions on other devices, unlike password-reset/MFA-disable which
deliberately do — see §5 and §6).

## 4. Test Suite C — Authorization (RBAC) matrix

This is the piece that isn't really "Auth module" code at all — every controller enforces it via
`[Authorize(Roles = "...")]` attributes, checked by ASP.NET's own middleware **before** your request
ever reaches a MediatR handler. That matters for what the response body looks like:

- **401/403 from `[Authorize]` itself** (no token, garbage token, or wrong role) → **empty body**, just
  the status code. Confirmed by direct test — don't expect an `ApiResponse` JSON envelope here.
- **401 from inside a handler** (e.g. `INVALID_CREDENTIALS` on Login) → full `ApiResponse` JSON, because
  that request *did* reach MediatR; the handler chose to return a 401 as business logic.

### C1. No token at all

```bash
curl -s -w "\nstatus: %{http_code}\nbody: [%{size_download} bytes]\n" http://localhost:5298/api/v1/users/me
```
**Expected:** `401`, 0-byte body.

### C2. Garbage/malformed token

```bash
curl -s -w "\nstatus: %{http_code}\n" http://localhost:5298/api/v1/users/me -H "Authorization: Bearer not-a-real-token"
```
**Expected:** `401`, 0-byte body.

### C3. Valid token, wrong role

Log in as `employee@seed.test`, then hit a PlatformAdmin-only endpoint:
```bash
EMP_TOKEN=$(curl -s -X POST http://localhost:5298/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"employee@seed.test","password":"<pwd>"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
curl -s -w "\nstatus: %{http_code}\n" http://localhost:5298/api/v1/admin/health -H "Authorization: Bearer $EMP_TOKEN"
```
**Expected:** `403`, 0-byte body — the token is perfectly valid, just the wrong role for this route.

### C4. Full role matrix (representative endpoints)

Log in as each of the 4 seed accounts and try each row — this is the fastest way to sanity-check the
whole authorization layer in one pass:

| Endpoint | PlatformAdmin | Auditor | CompanyAdmin | Employee |
|---|---|---|---|---|
| `GET /api/admin/health` | 200 | 403 | 403 | 403 |
| `POST /api/companies` | 403 | 200/201 | 403 | 403 |
| `GET /api/tasks` | 403 | 200 | 200 | 200 |
| `POST /api/tasks/{id}/status` | 403 | 200 | 403 | 200 (only if assigned to self — see `TaskItem.CanChangeStatus`) |
| `GET /api/reports` | 403 | 200 | 200 | 403 |
| `GET /api/users/me` | 200 | 200 | 200 | 200 (every authenticated role can read their own profile) |

If any cell doesn't match, check the corresponding controller's `[Authorize(Roles = "...")]` attribute
first (`ArchitectureFlow.md` §5 has the exact controller file per module) — a mismatch here is almost
always a copy-paste attribute error, not a deep bug.

### C5. (Optional, advanced) Tenant isolation

All 4 seed accounts above share **one** tenant, so this needs a second tenant to be meaningful:
1. Log in as `platformadmin@seed.test`.
2. `POST /api/admin/auditor-accounts` to create a second tenant (a brand new Auditor account).
3. That response doesn't hand you a login for the new tenant directly — realistically, exercising this
   end-to-end means inviting/creating a user under the new tenant and confirming they can't see the
   first tenant's Companies/Tasks/Users no matter what IDs they guess in the URL.
4. This exact scenario already has **automated coverage** — see
   `tests/AuditFlow.Integration.Tests/Web/CrossTenantIsolationIntegrationTests.cs`, which asserts a
   second tenant's caller gets `404`/empty results for the first tenant's data, and that PlatformAdmin
   is forbidden from every tenant-scoped route. Run it directly instead of reconstructing this by hand:
   ```
   dotnet test tests/AuditFlow.Integration.Tests --filter FullyQualifiedName~CrossTenantIsolationIntegrationTests
   ```

## 5. Test Suite D — Forgot / reset password

### D1. Request a reset

```bash
curl -s -X POST http://localhost:5298/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" -d '{"email":"auditor@seed.test"}'
```
**Expected:** `200`, always the same generic message
(`"If an account with that email exists, a password reset link has been sent."`) — **regardless of
whether the email exists**, deliberately, so this endpoint can't be used to enumerate accounts. Try it
again with `nobody@seed.test` and confirm you get the identical response.

**Where to find the actual token (dev mode):** open `C:\AuditFlow\EmailPickup\`, sort by newest, open
the `.html` file whose filename contains `auditor@seed.test` (filenames keep `@`/`.` as-is — only
characters Windows actually disallows in filenames get stripped). It contains an HTML comment
`<!-- To: auditor@seed.test | Subject: ... -->` followed by the email body with a link like:
```
http://localhost:3000/reset-password?email=auditor%40seed.test&token=CfDJ8...
```
Copy the `token` query-param value and **URL-decode it** (e.g. `%2F` → `/`, `%2B` → `+`) before pasting
it into the JSON body below — the raw email-link value won't match otherwise. A one-liner:
`node -e "console.log(decodeURIComponent(process.argv[1]))" '<paste-encoded-token>'`.

### D2. Reset the password

```bash
curl -s -X POST http://localhost:5298/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"auditor@seed.test","token":"<paste token>","newPassword":"<new-pwd>"}'
```
**Expected:** `200`, `"Password has been reset successfully..."`.

**DB check:**
```sql
-- Every active session for this user just got revoked (security-sensitive action)
SELECT RevokedAt FROM RefreshTokens WHERE UserId = '06ae13f1-b5dd-4c40-7099-08dee90407d5';
-- all rows should now have RevokedAt set

-- A PasswordChanged audit entry was written
SELECT TOP 1 Action FROM AuditLogs WHERE UserId = '06ae13f1-b5dd-4c40-7099-08dee90407d5'
  AND Action = 19 ORDER BY CreatedAt DESC; -- 19 = PasswordChanged
```
Confirm the old password (`<pwd>`) now fails login and the new one (`<new-pwd>`) works —
then reset it back to `<pwd>` via `POST /api/users/{userId}/reset-password` (logged in as
Auditor/CompanyAdmin) if you want this guide's credentials to keep working for later re-runs.

### D3. Invalid/expired token

```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:5298/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"auditor@seed.test","token":"garbage-token","newPassword":"<new-pwd>"}'
```
**Expected:** `400`, `errorCode: "INVALID_TOKEN"`.

## 6. Test Suite E — Invitation acceptance

This spans two modules — creating the invite is a **Users**-module action, only accepting it is Auth.

> If you're re-running this section after already completing it once, `test.invitee@example.com` will
> now be an Active user — inviting the same email again will behave differently (or be rejected).
> Use a fresh email (e.g. `test.invitee2@example.com`) for repeat runs.

### E1. Create an invitation (as Auditor or CompanyAdmin)

```bash
AUD_TOKEN=$(curl -s -X POST http://localhost:5298/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"auditor@seed.test","password":"<pwd>"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST http://localhost:5298/api/v1/users/invite -H "Authorization: Bearer $AUD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test Invitee","email":"test.invitee@example.com","role":4,"companyId":"6dfa5b92-8546-4e3d-a417-48e9bf861552"}'
```
**Expected:** `201`, `{ "invitationId": "...", "email": "test.invitee@example.com", "expiresAt": "..." }`.

**DB check:**
```sql
SELECT Id, Email, Status, ExpiresAt FROM Invitations WHERE Email = 'test.invitee@example.com';
-- Status = 1 (Pending)
SELECT Email, Status FROM Users WHERE Email = 'test.invitee@example.com';
-- A Users row already exists at this point too, Status = 1 (Invited), no PasswordHash yet
```

### E2. Validate the invite token

Open `C:\AuditFlow\EmailPickup\` again, find the newest file for `test.invitee@example.com`, extract
the `token` from the invite link (URL-decode it — e.g. `%2B` → `+`, `%2F` → `/` — before pasting into
JSON, or the token hash won't match), then:
```bash
curl -s http://localhost:5298/api/v1/invites/validate/<token>
```
**Expected:** `200`, `{ "invitationId": "...", "email": "test.invitee@example.com", "companyName": "Seed Company Inc", "role": 4, ... }`.

### E3. Accept the invitation

```bash
curl -s -X POST http://localhost:5298/api/v1/invites/accept \
  -H "Content-Type: application/json" \
  -d '{"token":"<paste token>","password":"<invitee-pwd>","confirmPassword":"<invitee-pwd>"}'
```
**Expected:** `201`, `{ "userId": "...", "email": "test.invitee@example.com", "accessToken": "...", "refreshToken": "..." }`
— note this returns a **usable session immediately**, no separate login step needed.

**DB check:**
```sql
SELECT Status, ActivatedAt FROM Users WHERE Email = 'test.invitee@example.com'; -- Status = 2 (Active)
SELECT Status, AcceptedAt, AcceptedByUserId FROM Invitations WHERE Email = 'test.invitee@example.com'; -- Status = 2 (Accepted)
SELECT TOP 1 Action FROM AuditLogs WHERE EntityId = (SELECT Id FROM Users WHERE Email = 'test.invitee@example.com')
  AND Action = 10 ORDER BY CreatedAt DESC; -- 10 = UserActivated
```

### E4. Re-use the same invitation (should fail)

```bash
curl -s -w "\nstatus: %{http_code}\n" -X POST http://localhost:5298/api/v1/invites/accept \
  -H "Content-Type: application/json" \
  -d '{"token":"<same token>","password":"<whatever-pwd>","confirmPassword":"<whatever-pwd>"}'
```
**Expected:** `400`, `errorCode: "INVITATION_USED"` (or `409 USER_ALREADY_ACTIVE`, depending on which
check trips first) — an invitation is single-use.

## 7. Test Suite F — MFA (multi-factor authentication)

Use `employee@seed.test` for this so you don't complicate the Auditor account you're using for other
tests.

### F1. Set up MFA

```bash
EMP_TOKEN=$(curl -s -X POST http://localhost:5298/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"employee@seed.test","password":"<pwd>"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST http://localhost:5298/api/v1/auth/mfa/setup -H "Authorization: Bearer $EMP_TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```
**Expected:** `200`, `{ "secret": "JBSWY3DPEHPK3PXP...", "qrCodeUrl": "otpauth://totp/AuditFlow:employee@seed.test?secret=...&algorithm=SHA1&digits=6&period=30", "recoveryCodes": [] }`.

**DB check:** `SELECT MfaEnabled, MfaSecret FROM Users WHERE Email = 'employee@seed.test';` —
`MfaEnabled` is still `0` at this point (setup only stores the secret, doesn't enable it yet).

### F2. Generate a 6-digit code from the secret

**Option A (real device, closest to production use):** add a new account in Google
Authenticator/Microsoft Authenticator/Authy via "enter setup key manually", paste the `secret`, use
the 6-digit code it shows.

**Option B (no phone needed — standard RFC 6238 TOTP, matches this app's settings exactly):** save this
as `totp.js` and run `node totp.js <secret>`:
```js
const crypto = require('crypto');
function base32Decode(b32) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of b32.replace(/=+$/, '').toUpperCase()) {
    const v = A.indexOf(c);
    if (v === -1) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return Buffer.from(bytes);
}
function totp(secret) {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}
console.log(totp(process.argv[2]));
```
The code is only valid for a 30-second window — generate it right before using it.

### F3. Verify (finish enabling MFA)

```bash
curl -s -X POST http://localhost:5298/api/v1/auth/mfa/verify -H "Authorization: Bearer $EMP_TOKEN" \
  -H "Content-Type: application/json" -d '{"code":"<6-digit code>"}'
```
**Expected:** `200`, `{ "recoveryCodes": ["a1b2c-d3e4f5", ... 8 total] }` — **save these**, they're
shown exactly once and let you disable MFA later without a working authenticator.

**DB check:**
```sql
SELECT MfaEnabled, MfaRecoveryCodes FROM Users WHERE Email = 'employee@seed.test'; -- MfaEnabled = 1
SELECT TOP 1 Action FROM AuditLogs WHERE UserId = (SELECT Id FROM Users WHERE Email='employee@seed.test')
  AND Action = 20 ORDER BY CreatedAt DESC; -- 20 = MfaEnabled
```

### F4. Log in with MFA enabled

```bash
curl -s -X POST http://localhost:5298/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"employee@seed.test","password":"<pwd>"}'
```
**Expected:** `200` but `{"requiresMfa": true, "user": {...}}` with **no** `accessToken` — you don't
get a usable session yet. Re-send with a fresh code:
```bash
curl -s -X POST http://localhost:5298/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"employee@seed.test","password":"<pwd>","mfaCode":"<fresh 6-digit code>"}'
```
**Expected:** `200`, full `accessToken`/`refreshToken` this time.

### F5. Disable MFA

```bash
curl -s -X POST http://localhost:5298/api/v1/auth/mfa/disable -H "Authorization: Bearer $EMP_TOKEN" \
  -H "Content-Type: application/json" -d '{"code":"<fresh 6-digit code, or one of the recovery codes>"}'
```
**Expected:** `200`, `"MFA has been disabled"`.

**DB check:**
```sql
SELECT MfaEnabled, MfaSecret FROM Users WHERE Email = 'employee@seed.test'; -- MfaEnabled = 0, MfaSecret = NULL
SELECT RevokedAt FROM RefreshTokens WHERE UserId = (SELECT Id FROM Users WHERE Email='employee@seed.test');
-- ALL rows revoked - disabling MFA force-logs-out every other session, same as password reset
```

## 8. Quick-reference: all DB checks in one place

```sql
-- Whoami / role / status for every seed user
SELECT Id, Email, Role, Status, MfaEnabled, LastLoginAt, AccessFailedCount FROM Users ORDER BY Role;

-- Active (non-revoked) sessions per user
SELECT UserId, COUNT(*) AS ActiveSessions FROM RefreshTokens WHERE RevokedAt IS NULL GROUP BY UserId;

-- Recent auth-related audit trail (Login=17, Logout=18, PasswordChanged=19, MfaEnabled=20, MfaDisabled=21, UserActivated=10)
SELECT TOP 20 Action, UserId, MetadataJson, CreatedAt FROM AuditLogs
WHERE Action IN (10, 17, 18, 19, 20, 21) ORDER BY CreatedAt DESC;

-- Pending / accepted invitations
SELECT Email, Status, ExpiresAt, AcceptedAt FROM Invitations ORDER BY CreatedAt DESC;
```

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every login returns `401 INVALID_CREDENTIALS` even with the right password | Check `Users.Status` — must be `2` (Active). `Invited` (1) and `Deactivated` (3) both fail login with `403 ACCOUNT_NOT_ACTIVE`, not `401`, so `401` specifically means the password itself is wrong (or the account genuinely doesn't exist). |
| `423 ACCOUNT_LOCKED` and you don't remember failing 5 logins | `AccessFailedCount` doesn't reset until a *successful* login — a stray failed attempt from earlier testing counts. Check `Users.AccessFailedCount`; wait 15 minutes or fix it directly via SQL. |
| Refresh always returns `401 INVALID_REFRESH_TOKEN` | You're reusing a token from a *previous* login session that's since been rotated/revoked by something else (another refresh call, a password reset, MFA disable) — always use the most recent `refreshToken` you were issued. |
| MFA code always rejected | Codes are 30-second windows — regenerate right before sending, don't reuse an old one. Also confirm you're using the `secret` from *this* Setup MFA call, not a stale one from an earlier attempt. |
| `403` with an empty body, no `errorCode` at all | This is `[Authorize]` rejecting the request before it reaches your handler — check the role on the JWT (§3, B1) against the controller action's `[Authorize(Roles = "...")]` attribute, not application logic. |
| Emails never seem to send | Confirm `appsettings.json`'s `Email:Provider` is `"Development"` and check `C:\AuditFlow\EmailPickup\` exists and has new `.html` files after each request — if the folder's empty, check the API console log for `"Email (dev pickup) for ... written to ..."` lines to confirm the handler actually reached the email step. |
