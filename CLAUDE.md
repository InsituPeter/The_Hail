# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev                                                      # start with nodemon (hot-reload)
docker-compose up -d                                             # start PostgreSQL + Redis + API
docker-compose down                                              # stop containers
docker-compose build --no-cache                                  # rebuild after dependency changes
docker exec hail_api npx prisma migrate dev --name <name>        # run migration inside container
npx prisma validate                                              # validate schema without migrating
npx prisma studio                                                # open Prisma GUI
```

Tests go in `__tests__/*.test.js`. Jest and Supertest are installed. No test files exist yet.

---

## Architecture

**Modular monolith** — one process, strictly one-way dependency flow:

```
routes → middleware → controller → service → repository → prisma
```

**Dependency injection** is constructor-based throughout. `container.js` is the single wiring point — every class is instantiated there and receives its dependencies as constructor arguments. No singletons outside of config clients (Prisma, Redis, logger, axios instances).

**Key constraint:** Controllers never import Prisma. Services never import Express. Repositories contain no business logic.

### Error handling

All custom errors extend `AppError` (`errors/AppError.js`). Throw from services or repositories. Controllers catch nothing — they call `next(err)` only. The 4-arg `errorHandler` middleware (registered last in `app.js`) serialises errors to JSON.

```js
// correct — in a controller
next(new ValidationError('Email is required'))

// wrong — never throw in a controller
throw new ValidationError('...')
```

### Repository pattern

Repositories are the only files that import Prisma. All `create`/`update` calls require the `{ data: {...} }` wrapper. The primary key is `userId` (not `id`) on the User model. Repositories export the class, not an instance — `container.js` instantiates them.

`rideRepository.findById()` and `transitionState()` both return the full ride with nested includes:
```js
include: {
    rider: { include: { user: { select: { userId: true } } } },
    driver: true,
    payment: true,
}
```
Code that reads from these can safely access `ride.rider.user.userId`, `ride.rider.paystackAuthorizationCode`, `ride.driver`, `ride.payment`.

`findByRider()` and `findByDriver()` use the same include block — always return full nested structure.

### State machines

`RideStateMachine` (`Domain/RideStateMachine.js`) — static `STATES`, `TRANSITIONS` map, `validateTransition(from, to)` throws `AppError (409)` on invalid moves. Called inside a `$transaction` by `rideRepository.transitionState()`.

States: `REQUESTED → ACCEPTED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED` (or `CANCELLED` from any state).

### Real-time

Socket.io runs on the same HTTP server. JWT is verified on socket connection via `authService.verifyAccessToken`. Each user joins room `user:{userId}`. Events are published to Redis channel `hail:events` as `{ userId, event, data }` — the subscriber emits to the correct room, making this work across multiple server instances.

---

## Payment (Paystack)

- Currency: **NGN**. Amounts stored in naira everywhere. Kobo conversion (`amount * 100`) happens only at the moment of Paystack API calls in `paymentService.js`.
- No pre-authorisation — riders are charged at ride completion via `chargeAuthorization`.
- Riders must have `paystackAuthorizationCode` on their `RiderProfile` (set up via a ₦100 verification charge) before requesting CARD rides.
- Drivers must have `paystackSubaccountCode` on their `DriverProfile` before accepting CARD rides.
- Platform fee: **10%** (`PLATFORM_FEE_PERCENT` env var, read in `config/index.js`). Driver subaccount split is derived as `100 - config.platformFeePercent` — do not hardcode 90.

### Fare table (NGN)
```js
ECONOMY: { base: 500,  rate: 150 }  // ₦500 + ₦150/km
COMFORT: { base: 800,  rate: 225 }  // ₦800 + ₦225/km
XL:      { base: 1200, rate: 300 }  // ₦1200 + ₦300/km
```

### Webhook
Paystack webhook is registered **before** `express.json()` in `app.js` so the raw body is preserved for HMAC-SHA512 signature verification.

---

## Key Files

| File | Purpose |
|---|---|
| `app.js` | Express setup, middleware order, HTTP server, startup/shutdown |
| `container.js` | DI wiring — all instantiation happens here |
| `config/index.js` | Single place all `process.env` reads happen. Loads `.${NODE_ENV}.env` if set, else `.env` |
| `prisma/schema.prisma` | Source of truth for DB schema and enums |
| `errors/index.js` | Barrel export of all error classes |
| `socket/index.js` | Socket.io + Redis pub/sub setup |
| `jobs/tokenCleanup.js` | Cron (daily 02:00) — deletes EXPIRED/REVOKED/USED tokens |
| `Services/userServices.js` | User CRUD; auto-creates RiderProfile on RIDER signup |
| `Services/rideService.js` | Full ride lifecycle + fare calculation |
| `Services/paymentService.js` | Paystack API: charge, subaccounts, webhook verification |
| `middleware/idempotency.js` | Caches responses in Redis for 24h by `X-Idempotency-Key` header. Must run **after** `validate` on any route — validation errors must not be cached |
| `middleware/authenticate.js` | Verifies Bearer JWT; sets `req.user` with `{ userId, email, role }` |

---

## Known Asymmetries

- **Driver profiles are not auto-created on signup.** Drivers must call `POST /api/drivers/me` manually with vehicle details. Rider profiles ARE auto-created in `userService.createUser`. This is intentional — driver profiles require vehicle data.
- **`riderService.createProfile` does not exist** — it was removed as dead code. Rider profile creation only happens through `userService.createUser`.
- **`Services/authServices.js`** is an incomplete draft file. The real implementation used by the app is **`Services/AuthService.js`** (capital A, S).
- **`Services/userService.js`** is an empty file. The real implementation is `Services/userServices.js` (with trailing s).
- **`config/email.js`** is unused dead code. Email transport is configured directly in `container.js`.

---

## Auth Token Pattern

Raw tokens (128-char hex) are never stored. Only their SHA-256 hash is persisted in the `Token` table. On verification, the raw token from the client is hashed and looked up. This means:
- `tokenRepository` always receives and stores **hashed** tokens
- `AuthService` always hashes with `_hashToken()` before any DB call
- Access tokens are JWTs (3h TTL). Refresh tokens are opaque DB-backed tokens (7d TTL, single-use via rotation).
- Password reset invalidates all active refresh tokens via `logoutAllDevices` — existing access tokens remain valid until expiry (stateless).

---

## Environment Variables

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@postgres:5432/hail_db
JWT_SECRET=
JWT_REFRESH_SECRET=
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
FRONTEND_URL=http://localhost:5173
COMPANY_NAME=The Hail
SUPPORT_EMAIL=
REDIS_URL=redis://localhost:6379
GOOGLE_MAPS_API_KEY=
PAYSTACK_SECRET_KEY=sk_test_
PLATFORM_FEE_PERCENT=10
```

---

## Working Style

This project is **didactic** — the process matters as much as the outcome.

1. **Explain before editing.** State the problem, why the current code is wrong, and what the fix does before making any non-trivial change.
2. **One concern at a time.** Don't batch unrelated changes into a single edit.
3. **Only introduce patterns when required.** No speculative boilerplate or abstractions.
4. **Follow Express conventions.** Don't apply patterns from Next.js, Fastify, or NestJS.
5. **Ask before assuming intent.** If a change touches something not explicitly requested, flag it first.
