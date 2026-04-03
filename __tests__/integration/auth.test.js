/**
 * Auth routes — Integration Tests
 *
 * WHAT WE'RE TESTING
 * The full HTTP request → Express middleware → Controller → Service →
 * Repository → PostgreSQL round-trip for every auth endpoint.
 *
 * Unlike unit tests (which mock the DB), these tests hit hail_db_test
 * directly. A botched assertion here means a real row is wrong — the
 * same kind of failure you'd see in production.
 *
 * MOCKING STRATEGY
 * Only one thing is mocked: the nodemailer transporter. We don't want to
 * send real emails in CI, and we need to inspect the email body to extract
 * the raw verification/reset tokens that the service embeds in URLs.
 * Everything else — Prisma, bcrypt, JWT — is real.
 *
 * RATE LIMITERS
 * The auth routes use authLimiter (10 req/15 min) and passwordResetLimiter
 * (5 req/hour). Both are replaced with pass-through middleware so tests
 * don't exhaust the in-memory counter and start returning 429.
 */

// ── Mocks (hoisted before any require()) ────────────────────────────────────

// Replace the nodemailer transporter with a jest spy so sendMail never
// opens a real SMTP connection. We inspect call args to extract tokens.
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' })
jest.mock('../../config/email', () => ({ sendMail: mockSendMail }))

// Replace rate limiters with no-ops so repeated requests never hit 429.
jest.mock('../../middleware/rateLimiter', () => ({
    authLimiter:          (_req, _res, next) => next(),
    generalLimiter:       (_req, _res, next) => next(),
    passwordResetLimiter: (_req, _res, next) => next(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

const request = require('supertest')
const { app }  = require('../../app')
const prisma   = require('../../config/prisma')
const { cleanDb, seedVerifiedRider } = require('./helpers')

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the raw token from the URL that the email service embeds in the
 * email body HTML. Works for both verification and password-reset emails.
 *
 * The service builds: `${frontendUrl}/<path>?token=<rawToken>`
 * We pull every `token=<hex>` occurrence out of the HTML.
 */
function extractTokenFromEmail(callIndex = 0) {
    const html = mockSendMail.mock.calls[callIndex][0].html
    const match = html.match(/token=([a-f0-9]+)/)
    if (!match) throw new Error('Could not find token in email HTML')
    return match[1]
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(async () => {
    await cleanDb()
    mockSendMail.mockClear()
})

afterAll(async () => {
    await prisma.$disconnect()
})

// ─── POST /api/v1/auth/register ──────────────────────────────────────────────────
//
// Registration creates a User row, auto-creates a RiderProfile (for RIDER),
// and fires a verification email. The user is NOT verified yet.

describe('POST /api/v1/auth/register', () => {
    const validBody = {
        name:     'New Rider',
        email:    'newrider@test.com',
        password: 'Password1!',
        role:     'RIDER',
    }

    it('returns 201 and a success message on valid input', async () => {
        const res = await request(app).post('/api/v1/auth/register').send(validBody)

        expect(res.status).toBe(201)
        expect(res.body.message).toMatch(/verify your email/i)
    })

    it('creates a User row in the database', async () => {
        await request(app).post('/api/v1/auth/register').send(validBody)

        const user = await prisma.user.findUnique({ where: { email: validBody.email } })
        expect(user).not.toBeNull()
        expect(user.name).toBe('New Rider')
        expect(user.role).toBe('RIDER')
    })

    it('auto-creates a RiderProfile for RIDER registrations', async () => {
        await request(app).post('/api/v1/auth/register').send(validBody)

        const user    = await prisma.user.findUnique({ where: { email: validBody.email } })
        const profile = await prisma.riderProfile.findUnique({ where: { userId: user.userId } })
        expect(profile).not.toBeNull()
    })

    it('stores the password as a bcrypt hash, not plaintext', async () => {
        await request(app).post('/api/v1/auth/register').send(validBody)

        const user = await prisma.user.findUnique({ where: { email: validBody.email } })
        expect(user.password).not.toBe(validBody.password)
        expect(user.password).toMatch(/^\$2[ab]\$/)
    })

    it('sends a verification email', async () => {
        await request(app).post('/api/v1/auth/register').send(validBody)

        expect(mockSendMail).toHaveBeenCalledTimes(1)
        const { to } = mockSendMail.mock.calls[0][0]
        expect(to).toBe(validBody.email)
    })

    it('does not set emailVerifiedAt — the account starts unverified', async () => {
        await request(app).post('/api/v1/auth/register').send(validBody)

        const user = await prisma.user.findUnique({ where: { email: validBody.email } })
        expect(user.emailVerifiedAt).toBeNull()
    })

    it('returns 409 when the email address is already registered', async () => {
        await request(app).post('/api/v1/auth/register').send(validBody)
        const res = await request(app).post('/api/v1/auth/register').send(validBody)

        expect(res.status).toBe(409)
    })

    it('returns 422 when required fields are missing', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'incomplete@test.com' }) // missing name, password, role

        expect(res.status).toBe(422)
    })
})

// ─── GET /api/v1/auth/verify-email ───────────────────────────────────────────────
//
// The client follows the link in the verification email. The token in the
// link is the raw token; the DB stores only its SHA-256 hash.
// We capture the raw token from the mocked sendMail call.

describe('GET /api/v1/auth/verify-email', () => {
    it('marks the user as verified and returns 200', async () => {
        await request(app).post('/api/v1/auth/register').send({
            name: 'Verify Me', email: 'verify@test.com', password: 'Password1!', role: 'RIDER',
        })

        const rawToken = extractTokenFromEmail()

        const res = await request(app)
            .get('/api/v1/auth/verify-email')
            .query({ token: rawToken })

        expect(res.status).toBe(200)

        const user = await prisma.user.findUnique({ where: { email: 'verify@test.com' } })
        expect(user.emailVerifiedAt).not.toBeNull()
    })

    it('returns 401 when the token is invalid', async () => {
        const res = await request(app)
            .get('/api/v1/auth/verify-email')
            .query({ token: 'this-is-not-a-valid-token' })

        expect(res.status).toBe(401)
    })

    it('returns 401 when the same token is used twice (replay prevention)', async () => {
        await request(app).post('/api/v1/auth/register').send({
            name: 'Replay Test', email: 'replay@test.com', password: 'Password1!', role: 'RIDER',
        })

        const rawToken = extractTokenFromEmail()

        await request(app).get('/api/v1/auth/verify-email').query({ token: rawToken })
        const res = await request(app).get('/api/v1/auth/verify-email').query({ token: rawToken })

        expect(res.status).toBe(401)
    })
})

// ─── POST /api/v1/auth/login ─────────────────────────────────────────────────────
//
// Login requires a verified email. Tests use seedVerifiedRider() to bypass
// the register → verify-email flow for setup.

describe('POST /api/v1/auth/login', () => {
    it('returns 200, an accessToken in the body, and a refreshToken cookie', async () => {
        const { email, password } = await seedVerifiedRider()

        const res = await request(app).post('/api/v1/auth/login').send({ email, password })

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveProperty('accessToken')
        expect(res.headers['set-cookie']).toEqual(
            expect.arrayContaining([expect.stringContaining('refreshToken=')])
        )
    })

    it('returns 403 when the password is wrong', async () => {
        const { email } = await seedVerifiedRider()

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email, password: 'WrongPassword1!' })

        expect(res.status).toBe(403)
    })

    it('returns 403 when the email is not verified', async () => {
        // Register but do NOT verify
        await request(app).post('/api/v1/auth/register').send({
            name: 'Unverified', email: 'unverified@test.com', password: 'Password1!', role: 'RIDER',
        })

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'unverified@test.com', password: 'Password1!' })

        expect(res.status).toBe(403)
    })

    it('returns 404 when the email is not registered', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'nobody@test.com', password: 'Password1!' })

        expect(res.status).toBe(404)
    })
})

// ─── POST /api/v1/auth/refresh ───────────────────────────────────────────────────
//
// The refresh token lives in an httpOnly cookie. Supertest preserves cookies
// between chained requests when we pass the Set-Cookie header manually.

describe('POST /api/v1/auth/refresh', () => {
    it('issues a new accessToken when a valid refresh cookie is present', async () => {
        const { email, password } = await seedVerifiedRider()

        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email, password })

        const cookies = loginRes.headers['set-cookie']

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', cookies)

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveProperty('accessToken')
    })

    it('returns 401 when no refresh cookie is present', async () => {
        const res = await request(app).post('/api/v1/auth/refresh')
        expect(res.status).toBe(401)
    })

    it('returns 401 when the refresh token has already been rotated (replay prevention)', async () => {
        const { email, password } = await seedVerifiedRider()

        const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password })
        const cookies  = loginRes.headers['set-cookie']

        // First refresh rotates the token — the old cookie is now invalid
        await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies)

        const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies)
        expect(res.status).toBe(401)
    })
})

// ─── POST /api/v1/auth/logout ────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
    it('returns 200 and clears the refresh cookie', async () => {
        const { email, password } = await seedVerifiedRider()

        const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password })
        const cookies  = loginRes.headers['set-cookie']

        const res = await request(app)
            .post('/api/v1/auth/logout')
            .set('Cookie', cookies)

        expect(res.status).toBe(200)
        // The server should instruct the browser to clear the cookie
        const setCookieHeader = res.headers['set-cookie']?.join(';') ?? ''
        expect(setCookieHeader).toMatch(/refreshToken=;|refreshToken=(?:;|$)/)
    })

    it('returns 200 even with no cookie (idempotent logout)', async () => {
        const res = await request(app).post('/api/v1/auth/logout')
        expect(res.status).toBe(200)
    })

    it('invalidates the refresh token so it cannot be used after logout', async () => {
        const { email, password } = await seedVerifiedRider()

        const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password })
        const cookies  = loginRes.headers['set-cookie']

        await request(app).post('/api/v1/auth/logout').set('Cookie', cookies)

        const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies)
        expect(res.status).toBe(401)
    })
})
