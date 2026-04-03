/**
 * CircuitBreaker
 *
 * Prevents cascading failures when a downstream service (Paystack) is
 * consistently unavailable. Works in three states:
 *
 *   CLOSED   — normal operation; every call goes through.
 *   OPEN     — fast-fail; calls throw immediately without hitting the network.
 *              Entered after `threshold` consecutive failures.
 *   HALF_OPEN — one probe call is allowed through after `cooldownMs` elapses.
 *              Success → CLOSED; failure → OPEN (reset cooldown timer).
 *
 * RELATIONSHIP WITH _withRetry
 * The retry logic handles transient errors (one bad response, a momentary
 * network blip). The circuit breaker handles sustained outages — it only
 * records a failure after all retry attempts are exhausted. This means
 * a brief 5xx spike retries and recovers silently; only a prolonged
 * outage trips the breaker.
 *
 * USAGE
 *   const breaker = new CircuitBreaker({ threshold: 5, cooldownMs: 30_000 })
 *   const result  = await breaker.call(() => someAsyncOperation())
 */

const { AppError } = require('../errors')

class CircuitBreaker {
    /**
     * @param {object} opts
     * @param {number} opts.threshold  — consecutive failures before opening (default 5)
     * @param {number} opts.cooldownMs — ms to wait in OPEN before probing (default 30 000)
     */
    constructor({ threshold = 5, cooldownMs = 30_000 } = {}) {
        this._state      = 'CLOSED'
        this._failures   = 0
        this._threshold  = threshold
        this._cooldownMs = cooldownMs
        this._openedAt   = null
    }

    /**
     * Current state, with automatic OPEN → HALF_OPEN transition once the
     * cooldown period has elapsed.
     */
    get state() {
        if (this._state === 'OPEN' && Date.now() - this._openedAt >= this._cooldownMs) {
            this._state = 'HALF_OPEN'
        }
        return this._state
    }

    /**
     * Execute `fn` through the circuit breaker.
     * Throws AppError (503) immediately when the circuit is OPEN.
     *
     * @param {() => Promise<any>} fn
     */
    async call(fn) {
        if (this.state === 'OPEN') {
            throw new AppError('Payment service is temporarily unavailable — please try again shortly', 503)
        }

        try {
            const result = await fn()
            this._onSuccess()
            return result
        } catch (err) {
            this._onFailure()
            throw err
        }
    }

    _onSuccess() {
        this._failures = 0
        this._state    = 'CLOSED'
    }

    _onFailure() {
        this._failures++
        if (this._state === 'HALF_OPEN' || this._failures >= this._threshold) {
            this._state    = 'OPEN'
            this._openedAt = Date.now()
            this._failures = this._threshold   // cap so it doesn't overflow
        }
    }
}

module.exports = CircuitBreaker
