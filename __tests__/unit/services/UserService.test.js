/**
 * UserService — Unit Tests
 *
 * WHAT WE'RE TESTING
 * UserService.createUser() is the registration entry point. It has three
 * responsibilities we want to verify:
 *   1. Rejects duplicate emails
 *   2. Auto-creates a RiderProfile when role === 'RIDER'
 *   3. Does NOT create a RiderProfile for DRIVER accounts
 *   4. Never returns the password hash in the response
 *
 * WHY THESE TESTS MATTER
 * The RiderProfile auto-creation was a bug we fixed (Issue 5 in the audit).
 * A test here locks that behaviour in — if someone accidentally removes the
 * `if (role === 'RIDER')` block in the future, this test fails immediately
 * rather than silently breaking ride requests for all new riders.
 */

jest.mock('bcryptjs')
const bcrypt = require('bcryptjs')

const UserService = require('../../../Services/userServices')
const { ValidationError, ConflictError } = require('../../../errors')

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeUserRepository(overrides = {}) {
    return {
        existByEmail:  jest.fn(),
        create:        jest.fn(),
        findById:      jest.fn(),
        findByEmail:   jest.fn(),
        updateProfile: jest.fn(),
        softDelete:    jest.fn(),
        ...overrides,
    }
}

function makeRiderRepository(overrides = {}) {
    return {
        create:       jest.fn(),
        findByUserId: jest.fn(),
        ...overrides,
    }
}

function makeEmailService() {
    return {
        sendWelcomeEmail: jest.fn().mockResolvedValue(),
    }
}

// ─── createUser() ─────────────────────────────────────────────────────────────

describe('UserService.createUser()', () => {
    let userService, userRepository, riderRepository

    const validRiderData = {
        email:    'rider@test.com',
        password: 'password123',
        name:     'Test Rider',
        role:     'RIDER',
        phone:    '08012345678',
    }

    beforeEach(() => {
        userRepository  = makeUserRepository()
        riderRepository = makeRiderRepository()
        userService     = new UserService(userRepository, makeEmailService(), riderRepository)

        // Default: email does not exist, create succeeds, bcrypt hashes the password
        userRepository.existByEmail.mockResolvedValue(false)
        userRepository.create.mockResolvedValue({ ...validRiderData, userId: 1, password: 'hashed' })
        bcrypt.hash.mockResolvedValue('hashed')
    })

    it('throws ValidationError when a required field is missing', async () => {
        // phone is missing
        await expect(
            userService.createUser({ email: 'a@b.com', password: 'pass', name: 'Name', role: 'RIDER' })
        ).rejects.toThrow(ValidationError)
    })

    it('throws ConflictError when email is already registered', async () => {
        userRepository.existByEmail.mockResolvedValue(true)

        await expect(userService.createUser(validRiderData)).rejects.toThrow(ConflictError)
    })

    it('creates a RiderProfile automatically when role is RIDER', async () => {
        await userService.createUser(validRiderData)

        // riderRepository.create must have been called with the new user's ID
        expect(riderRepository.create).toHaveBeenCalledWith(1)
    })

    it('does NOT create a RiderProfile when role is DRIVER', async () => {
        userRepository.create.mockResolvedValue({ ...validRiderData, role: 'DRIVER', userId: 2, password: 'hashed' })

        await userService.createUser({ ...validRiderData, role: 'DRIVER' })

        expect(riderRepository.create).not.toHaveBeenCalled()
    })

    it('returns the user without the password field', async () => {
        const result = await userService.createUser(validRiderData)

        // The password hash must never leave the service layer
        expect(result).not.toHaveProperty('password')
        expect(result.email).toBe('rider@test.com')
    })

    it('hashes the password before storing it', async () => {
        await userService.createUser(validRiderData)

        // bcrypt.hash called with plaintext password and salt rounds
        expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10)
        // userRepository.create receives the hash, not the plaintext
        expect(userRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ password: 'hashed' })
        )
    })
})
