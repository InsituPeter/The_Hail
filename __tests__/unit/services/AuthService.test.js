/**
 * AuthService — Unit Tests
 *
 * WHAT WE'RE TESTING
 * AuthService handles every auth flow: login, token refresh, logout,
 * email verification, and password reset. These are the most security-sensitive
 * paths in the codebase. A bug here means accounts can be hijacked, bypassed,
 * or locked out — so we test every guard clause explicitly.
 *
 * HOW MOCKING WORKS HERE
 * AuthService imports `config` directly (not via constructor) to read the JWT
 * secret. We must set process.env.JWT_SECRET before Node loads that module.
 * Setting it at the top of this file, before any require(), achieves that.
 *
 * bcrypt is slow by design — it's tuned to take ~100ms per hash to resist
 * brute-force attacks. That's fine in production but would make the test suite
 * painfully slow. We mock it so tests run in milliseconds while still verifying
 * the logic that depends on its return value.
 */

// Set env vars BEFORE any require() — config/index.js reads them at import time
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'

// Tell Jest to replace the real bcrypt module with a fake one for this file
jest.mock('bcryptjs')
const bcrypt = require('bcryptjs')

const AuthService = require('../../../Services/AuthService')
const {
    NotFoundError,
    ForbiddenError,
    AuthorizationError,
    ConflictError,
} = require('../../../errors')

// ─── Mock factories ───────────────────────────────────────────────────────────
//
// These functions return plain objects whose methods are jest.fn() fakes.
// We call them inside beforeEach so every test starts with fresh mocks —
// no call counts or return values leaking between tests.

function makeUserRepository(overrides = {}) {
    return {
        findByEmail:   jest.fn(),
        findById:      jest.fn(),
        existByEmail:  jest.fn(),
        create:        jest.fn(),
        activateUser:  jest.fn(),
        updateProfile: jest.fn(),
        ...overrides,
    }
}

function makeTokenRepository(overrides = {}) {
    return {
        create:       jest.fn(),
        findByToken:  jest.fn(),
        revokeToken:  jest.fn(),
        findByUserId: jest.fn(),
        ...overrides,
    }
}

function makeEmailService(overrides = {}) {
    return {
        sendEmailVerification:  jest.fn().mockResolvedValue(),
        sendPasswordResetEmail: jest.fn().mockResolvedValue(),
        sendWelcomeEmail:       jest.fn().mockResolvedValue(),
        ...overrides,
    }
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const activeUser = {
    userId:          1,
    email:           'rider@test.com',
    password:        'hashed_password',
    name:            'Test Rider',
    role:            'RIDER',
    emailVerifiedAt: new Date('2026-01-01'),
    deletedAt:       null,
}

// ─── login() ─────────────────────────────────────────────────────────────────
//
// login() has four guard clauses. Each test below trips exactly one.
// The order matters: deletedAt is checked AFTER password comparison,
// so a deleted user with a wrong password still fails on the password check.

describe('AuthService.login()', () => {
    let authService, userRepository, tokenRepository

    beforeEach(() => {
        userRepository  = makeUserRepository()
        tokenRepository = makeTokenRepository()
        authService     = new AuthService(userRepository, tokenRepository, makeEmailService())
    })

    it('throws NotFoundError when email does not exist', async () => {
        userRepository.findByEmail.mockResolvedValue(null)

        await expect(
            authService.login('nobody@test.com', 'pass', '127.0.0.1', 'agent')
        ).rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError when password does not match', async () => {
        userRepository.findByEmail.mockResolvedValue(activeUser)
        // bcrypt.compare is mocked — return false to simulate wrong password
        bcrypt.compare.mockResolvedValue(false)

        await expect(
            authService.login('rider@test.com', 'wrongpass', '127.0.0.1', 'agent')
        ).rejects.toThrow(ForbiddenError)
    })

    it('throws NotFoundError when account is soft-deleted', async () => {
        userRepository.findByEmail.mockResolvedValue({ ...activeUser, deletedAt: new Date() })
        bcrypt.compare.mockResolvedValue(true)

        await expect(
            authService.login('rider@test.com', 'pass', '127.0.0.1', 'agent')
        ).rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError when email has not been verified', async () => {
        userRepository.findByEmail.mockResolvedValue({ ...activeUser, emailVerifiedAt: null })
        bcrypt.compare.mockResolvedValue(true)

        await expect(
            authService.login('rider@test.com', 'pass', '127.0.0.1', 'agent')
        ).rejects.toThrow(ForbiddenError)
    })

    it('returns user, accessToken, and refreshToken on success', async () => {
        userRepository.findByEmail.mockResolvedValue(activeUser)
        bcrypt.compare.mockResolvedValue(true)
        // tokenRepository.create is called by _generateRefreshToken internally
        tokenRepository.create.mockResolvedValue()

        const result = await authService.login('rider@test.com', 'pass', '127.0.0.1', 'agent')

        expect(result).toHaveProperty('accessToken')
        expect(result).toHaveProperty('refreshToken')
        // Password must never be returned to the caller
        expect(result.user).not.toHaveProperty('password')
        expect(result.user.email).toBe('rider@test.com')
    })
})

// ─── generateAccessToken / verifyAccessToken ─────────────────────────────────
//
// These are pure functions — no DB calls, no side effects.
// We test them together because they're a matched pair: sign → verify.

describe('AuthService token helpers', () => {
    let authService

    beforeEach(() => {
        authService = new AuthService(makeUserRepository(), makeTokenRepository(), makeEmailService())
    })

    it('verifyAccessToken recovers the payload from a token it signed', () => {
        const token   = authService.generateAccessToken({ userId: 42, email: 'a@b.com', role: 'RIDER' })
        const decoded = authService.verifyAccessToken(token)

        expect(decoded.userId).toBe(42)
        expect(decoded.email).toBe('a@b.com')
        expect(decoded.role).toBe('RIDER')
    })

    it('verifyAccessToken throws AuthorizationError for a tampered token', () => {
        expect(() =>
            authService.verifyAccessToken('this.is.not.valid')
        ).toThrow(AuthorizationError)
    })
})

// ─── verifyEmailToken() ───────────────────────────────────────────────────────
//
// Verifying an email token has four guards before the happy path.
// Notice the stored token object shape — it must match what tokenRepository
// returns (which we updated in Fix 1 to include emailVerifiedAt/deletedAt).

describe('AuthService.verifyEmailToken()', () => {
    let authService, userRepository, tokenRepository

    const validToken = {
        tokenId:  10,
        userId:   1,
        type:     'EMAIL_VERIFICATION',
        state:    'ACTIVE',
        expiresAt: new Date(Date.now() + 3_600_000), // 1 hour from now
    }

    beforeEach(() => {
        userRepository  = makeUserRepository()
        tokenRepository = makeTokenRepository()
        authService     = new AuthService(userRepository, tokenRepository, makeEmailService())
    })

    it('throws AuthorizationError when token is not in the DB', async () => {
        tokenRepository.findByToken.mockResolvedValue(null)
        await expect(authService.verifyEmailToken('fake')).rejects.toThrow(AuthorizationError)
    })

    it('throws AuthorizationError when token type is wrong', async () => {
        tokenRepository.findByToken.mockResolvedValue({ ...validToken, type: 'PASSWORD_RESET' })
        await expect(authService.verifyEmailToken('fake')).rejects.toThrow(AuthorizationError)
    })

    it('throws AuthorizationError when token has already been used', async () => {
        tokenRepository.findByToken.mockResolvedValue({ ...validToken, state: 'USED' })
        await expect(authService.verifyEmailToken('fake')).rejects.toThrow(AuthorizationError)
    })

    it('throws AuthorizationError when token has expired', async () => {
        tokenRepository.findByToken.mockResolvedValue({
            ...validToken,
            expiresAt: new Date(Date.now() - 1000), // 1 second in the past
        })
        await expect(authService.verifyEmailToken('fake')).rejects.toThrow(AuthorizationError)
    })

    it('revokes the token and activates the user on success', async () => {
        tokenRepository.findByToken.mockResolvedValue(validToken)
        tokenRepository.revokeToken.mockResolvedValue()
        userRepository.activateUser.mockResolvedValue()

        await authService.verifyEmailToken('any-raw-token')

        // Both side effects must fire — revoking prevents reuse, activating unlocks login
        expect(tokenRepository.revokeToken).toHaveBeenCalledTimes(1)
        expect(userRepository.activateUser).toHaveBeenCalledWith(validToken.userId)
    })
})

// ─── resetPassword() ─────────────────────────────────────────────────────────
//
// Same four-guard pattern as verifyEmailToken, but the token type is
// PASSWORD_RESET and the success path updates the user's password hash.

describe('AuthService.resetPassword()', () => {
    let authService, userRepository, tokenRepository

    const validToken = {
        tokenId:   20,
        userId:    1,
        type:      'PASSWORD_RESET',
        state:     'ACTIVE',
        expiresAt: new Date(Date.now() + 3_600_000),
    }

    beforeEach(() => {
        userRepository  = makeUserRepository()
        tokenRepository = makeTokenRepository()
        authService     = new AuthService(userRepository, tokenRepository, makeEmailService())
    })

    it('throws AuthorizationError when token is not found', async () => {
        tokenRepository.findByToken.mockResolvedValue(null)
        await expect(authService.resetPassword('fake', 'newpass')).rejects.toThrow(AuthorizationError)
    })

    it('throws AuthorizationError when token type is EMAIL_VERIFICATION', async () => {
        tokenRepository.findByToken.mockResolvedValue({ ...validToken, type: 'EMAIL_VERIFICATION' })
        await expect(authService.resetPassword('fake', 'newpass')).rejects.toThrow(AuthorizationError)
    })

    it('revokes token and updates password hash on success', async () => {
        tokenRepository.findByToken.mockResolvedValue(validToken)
        tokenRepository.revokeToken.mockResolvedValue()
        bcrypt.hash.mockResolvedValue('new_hashed_password')
        userRepository.updateProfile.mockResolvedValue()

        await authService.resetPassword('any-raw-token', 'newStrongPassword')

        expect(tokenRepository.revokeToken).toHaveBeenCalledTimes(1)
        // updateProfile must receive the hashed password, not the plaintext one
        expect(userRepository.updateProfile).toHaveBeenCalledWith(
            validToken.userId,
            { password: 'new_hashed_password' }
        )
    })
})
