/**
 * PaymentService — Unit Tests
 *
 * WHAT WE'RE TESTING
 * PaymentService is the boundary between our application and Paystack's API.
 * Every method either calls out to Paystack or validates a Paystack webhook.
 * Our tests must confirm two things for each method:
 *   1. When Paystack returns a success response, we extract and return the right fields.
 *   2. When Paystack returns failure (or a bad signature), we throw the right error.
 *
 * ABOUT MOCKING THE HTTP CLIENT
 * PaymentService receives a `paystackClient` via constructor — a pre-configured
 * axios instance. Because it's injected, we can substitute a plain object with
 * jest.fn() methods for `post` and `get`. The service never knows the difference.
 * This is the payoff of dependency injection: no real HTTP calls in tests.
 *
 * ABOUT constructWebhookEvent
 * This method is synchronous and purely cryptographic — it computes an HMAC-SHA512
 * hash of the raw request body and compares it against the Paystack signature header.
 * We can test it with real crypto by generating a valid HMAC ourselves in the test,
 * then confirming a different signature throws AppError. No mocking needed here.
 *
 * ABOUT THE KOBO CONVERSION
 * The service stores and accepts amounts in Naira but Paystack's API works in Kobo
 * (1 Naira = 100 Kobo). The conversion happens inside the service before every API
 * call. Our tests verify the converted value is what Paystack receives.
 *
 * ABOUT THE PLATFORM FEE
 * chargeAuthorization sends a `transaction_charge` field to Paystack — this is how
 * the platform keeps its 10% cut. The fee is calculated in Kobo:
 *   fee = round(amountInKobo × (platformFeePercent / 100))
 * We verify the exact fee value reaches Paystack, preventing silent fee miscalculations.
 */

const crypto = require('crypto')
const PaymentService = require('../../../Services/paymentService')
const { AppError } = require('../../../errors')

// ─── Mock factories ───────────────────────────────────────────────────────────

function makePaystackClient(overrides = {}) {
    return {
        post: jest.fn(),
        get:  jest.fn(),
        ...overrides,
    }
}

// config mirrors the shape in config/index.js
const testConfig = {
    paystack: { secretKey: 'test_secret_key' },
    platformFeePercent: 10,
}

// ─── constructWebhookEvent() ──────────────────────────────────────────────────
//
// This is a pure function — no axios calls, no async. We generate a valid HMAC
// ourselves so we can test both the success path and the rejection path.
//
// Why HMAC-SHA512? Paystack chose SHA512 for its 512-bit output (vs SHA256's 256
// bits), making brute-force attacks harder. Our code must use the same algorithm
// or the computed hash will never match.

describe('PaymentService.constructWebhookEvent()', () => {
    let paymentService

    beforeEach(() => {
        paymentService = new PaymentService(makePaystackClient(), testConfig)
    })

    it('parses and returns the event body when signature is valid', () => {
        const body      = JSON.stringify({ event: 'charge.success', data: { reference: 'REF_123' } })
        // Generate the signature the same way Paystack does — HMAC-SHA512 of the raw body
        const signature = crypto
            .createHmac('sha512', testConfig.paystack.secretKey)
            .update(body)
            .digest('hex')

        const result = paymentService.constructWebhookEvent(body, signature)

        // The method should return the parsed JSON — controllers use result.event
        expect(result.event).toBe('charge.success')
        expect(result.data.reference).toBe('REF_123')
    })

    it('throws AppError when signature does not match', () => {
        const body = JSON.stringify({ event: 'charge.success' })

        expect(() =>
            paymentService.constructWebhookEvent(body, 'this-is-not-the-right-hmac')
        ).toThrow(AppError)
    })

    it('throws AppError when body has been tampered with after signing', () => {
        // Sign the original body, then change the body — hash will no longer match
        const original  = JSON.stringify({ amount: 1000 })
        const signature = crypto
            .createHmac('sha512', testConfig.paystack.secretKey)
            .update(original)
            .digest('hex')

        const tampered = JSON.stringify({ amount: 999999 })

        // The signature was computed over `original` — it won't match `tampered`
        expect(() =>
            paymentService.constructWebhookEvent(tampered, signature)
        ).toThrow(AppError)
    })
})

// ─── chargeAuthorization() ───────────────────────────────────────────────────
//
// This is the core payment call — it fires when a ride completes and the rider
// is paying by card. We verify:
//   - The correct Kobo amount is sent (naira × 100)
//   - The platform fee is calculated and sent as transaction_charge
//   - The authorization code, email, and subaccount code reach Paystack
//   - A failed charge throws AppError with a 402 status (Payment Required)

describe('PaymentService.chargeAuthorization()', () => {
    let paymentService, paystackClient

    beforeEach(() => {
        paystackClient  = makePaystackClient()
        paymentService  = new PaymentService(paystackClient, testConfig)
    })

    it('returns the Paystack reference on a successful charge', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { status: 'success', reference: 'REF_abc' } },
        })

        const result = await paymentService.chargeAuthorization(
            'AUTH_xxx', 'rider@test.com', 2000, 'ACCT_yyy'
        )

        expect(result).toEqual({ reference: 'REF_abc' })
    })

    it('sends amountInKobo (naira × 100) to Paystack', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { status: 'success', reference: 'REF_abc' } },
        })

        // ₦2000 = 200000 kobo
        await paymentService.chargeAuthorization('AUTH_xxx', 'rider@test.com', 2000, 'ACCT_yyy')

        expect(paystackClient.post).toHaveBeenCalledWith(
            '/transaction/charge_authorization',
            expect.objectContaining({ amount: 200000 })
        )
    })

    it('sends the correct platform fee as transaction_charge', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { status: 'success', reference: 'REF_abc' } },
        })

        // ₦2000 = 200000 kobo; 10% platform fee = 20000 kobo
        await paymentService.chargeAuthorization('AUTH_xxx', 'rider@test.com', 2000, 'ACCT_yyy')

        expect(paystackClient.post).toHaveBeenCalledWith(
            '/transaction/charge_authorization',
            expect.objectContaining({ transaction_charge: 20000 })
        )
    })

    it('sends authorization_code, email, and subaccount to Paystack', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { status: 'success', reference: 'REF_abc' } },
        })

        await paymentService.chargeAuthorization('AUTH_xxx', 'rider@test.com', 2000, 'ACCT_yyy')

        expect(paystackClient.post).toHaveBeenCalledWith(
            '/transaction/charge_authorization',
            expect.objectContaining({
                authorization_code: 'AUTH_xxx',
                email:              'rider@test.com',
                subaccount:         'ACCT_yyy',
            })
        )
    })

    it('throws AppError when Paystack returns a non-success status', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { status: 'failed', reference: null } },
        })

        await expect(
            paymentService.chargeAuthorization('AUTH_xxx', 'rider@test.com', 2000, 'ACCT_yyy')
        ).rejects.toThrow(AppError)
    })
})

// ─── verifyTransaction() ─────────────────────────────────────────────────────
//
// This is called after a rider completes the ₦100 card setup flow. Paystack
// redirects the rider back to our callback URL with a `reference` query param.
// We verify the reference and extract the authorization_code from the response.
// The authorization_code is what we store and later use with chargeAuthorization.

describe('PaymentService.verifyTransaction()', () => {
    let paymentService, paystackClient

    beforeEach(() => {
        paystackClient = makePaystackClient()
        paymentService = new PaymentService(paystackClient, testConfig)
    })

    it('returns authorizationCode and email on a successful verification', async () => {
        paystackClient.get.mockResolvedValue({
            data: {
                data: {
                    status: 'success',
                    authorization: { authorization_code: 'AUTH_new' },
                    customer: { email: 'rider@test.com' },
                },
            },
        })

        const result = await paymentService.verifyTransaction('REF_setup')

        expect(result).toEqual({
            authorizationCode: 'AUTH_new',
            email: 'rider@test.com',
        })
    })

    it('queries the correct Paystack endpoint with the reference', async () => {
        paystackClient.get.mockResolvedValue({
            data: {
                data: {
                    status: 'success',
                    authorization: { authorization_code: 'AUTH_new' },
                    customer: { email: 'rider@test.com' },
                },
            },
        })

        await paymentService.verifyTransaction('REF_setup')

        expect(paystackClient.get).toHaveBeenCalledWith('/transaction/verify/REF_setup')
    })

    it('throws AppError when the transaction status is not success', async () => {
        paystackClient.get.mockResolvedValue({
            data: {
                data: { status: 'abandoned' },
            },
        })

        await expect(
            paymentService.verifyTransaction('REF_setup')
        ).rejects.toThrow(AppError)
    })
})

// ─── _withRetry() ────────────────────────────────────────────────────────────
//
// All Paystack calls pass through _withRetry. The rules:
//   - Retryable errors: HTTP 5xx responses, ECONNRESET, ETIMEDOUT
//   - Non-retryable errors: HTTP 4xx (card declined, bad params, etc.)
//   - On success before maxAttempts, returns the result without further calls
//   - After maxAttempts retryable failures, throws the last error
//
// We test _withRetry indirectly through chargeAuthorization so the mock wiring
// is identical to the production path.

describe('PaymentService retry logic (_withRetry)', () => {
    let paymentService, paystackClient

    beforeEach(() => {
        jest.useFakeTimers()
        paystackClient = makePaystackClient()
        paymentService = new PaymentService(paystackClient, testConfig)
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('succeeds immediately and does not retry when the first attempt works', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { status: 'success', reference: 'REF_ok' } },
        })

        await paymentService.chargeAuthorization('AUTH_x', 'a@b.com', 100, 'ACCT_y')

        expect(paystackClient.post).toHaveBeenCalledTimes(1)
    })

    it('retries on a 500 error and returns the result when the second attempt succeeds', async () => {
        const serverError = Object.assign(new Error('Server error'), { response: { status: 500 } })

        paystackClient.post
            .mockRejectedValueOnce(serverError)
            .mockResolvedValue({ data: { data: { status: 'success', reference: 'REF_retry' } } })

        // Attach the result assertion before advancing timers so the promise
        // is considered "handled" from the moment it is created.
        const resultPromise = paymentService.chargeAuthorization('AUTH_x', 'a@b.com', 100, 'ACCT_y')
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(paystackClient.post).toHaveBeenCalledTimes(2)
        expect(result).toEqual({ reference: 'REF_retry' })
    })

    it('retries on ECONNRESET and succeeds on the second attempt', async () => {
        const networkError = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })

        paystackClient.post
            .mockRejectedValueOnce(networkError)
            .mockResolvedValue({ data: { data: { status: 'success', reference: 'REF_net' } } })

        const resultPromise = paymentService.chargeAuthorization('AUTH_x', 'a@b.com', 100, 'ACCT_y')
        await jest.runAllTimersAsync()
        const result = await resultPromise

        expect(paystackClient.post).toHaveBeenCalledTimes(2)
        expect(result).toEqual({ reference: 'REF_net' })
    })

    it('throws immediately on a 400 error without retrying', async () => {
        const clientError = Object.assign(new Error('Bad request'), { response: { status: 400 } })
        paystackClient.post.mockRejectedValue(clientError)

        // Attach .rejects before advancing timers to avoid unhandled-rejection warnings.
        const assertion = expect(
            paymentService.chargeAuthorization('AUTH_x', 'a@b.com', 100, 'ACCT_y')
        ).rejects.toThrow('Bad request')
        await jest.runAllTimersAsync()
        await assertion

        expect(paystackClient.post).toHaveBeenCalledTimes(1)
    })

    it('throws after 3 attempts when all attempts fail with a retryable error', async () => {
        const serverError = Object.assign(new Error('Gateway timeout'), { response: { status: 503 } })
        paystackClient.post.mockRejectedValue(serverError)

        const assertion = expect(
            paymentService.chargeAuthorization('AUTH_x', 'a@b.com', 100, 'ACCT_y')
        ).rejects.toThrow('Gateway timeout')
        await jest.runAllTimersAsync()
        await assertion

        expect(paystackClient.post).toHaveBeenCalledTimes(3)
    })

    it('fast-fails with 503 AppError when the circuit is open (5 prior exhausted-retry failures)', async () => {
        // Each call exhausts all 3 retries before the circuit breaker records a failure.
        // After 5 such failures the circuit opens.
        const serverError = Object.assign(new Error('Down'), { response: { status: 503 } })
        paystackClient.post.mockRejectedValue(serverError)

        // Trip the circuit: 5 calls × 3 attempts each = 15 post() calls
        for (let i = 0; i < 5; i++) {
            const a = expect(
                paymentService.chargeAuthorization('AUTH_x', 'a@b.com', 100, 'ACCT_y')
            ).rejects.toThrow()
            await jest.runAllTimersAsync()
            await a
        }

        paystackClient.post.mockClear()

        // Circuit is now OPEN — this call must fast-fail without hitting post()
        const assertion = expect(
            paymentService.chargeAuthorization('AUTH_x', 'a@b.com', 100, 'ACCT_y')
        ).rejects.toThrow('temporarily unavailable')
        await jest.runAllTimersAsync()
        await assertion

        expect(paystackClient.post).not.toHaveBeenCalled()
    })
})

// ─── createSubaccount() ──────────────────────────────────────────────────────
//
// Called once when a driver sets up their payout account. Paystack creates a
// subaccount that receives ride payments minus the platform fee. We verify
// that the subaccount_code is extracted and returned correctly.

describe('PaymentService.createSubaccount()', () => {
    let paymentService, paystackClient

    beforeEach(() => {
        paystackClient = makePaystackClient()
        paymentService = new PaymentService(paystackClient, testConfig)
    })

    it('returns the subaccountCode from the Paystack response', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { subaccount_code: 'ACCT_new_driver' } },
        })

        const result = await paymentService.createSubaccount({
            businessName:      'Test Driver',
            settlementBank:    '011',
            accountNumber:     '0123456789',
            percentageCharge:  90,
        })

        expect(result).toEqual({ subaccountCode: 'ACCT_new_driver' })
    })

    it('sends all required fields to the Paystack subaccount endpoint', async () => {
        paystackClient.post.mockResolvedValue({
            data: { data: { subaccount_code: 'ACCT_new_driver' } },
        })

        await paymentService.createSubaccount({
            businessName:     'Test Driver',
            settlementBank:   '011',
            accountNumber:    '0123456789',
            percentageCharge: 90,
        })

        expect(paystackClient.post).toHaveBeenCalledWith('/subaccount', {
            business_name:      'Test Driver',
            settlement_bank:    '011',
            account_number:     '0123456789',
            percentage_charge:  90,
        })
    })
})
