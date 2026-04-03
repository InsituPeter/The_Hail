/**
 * Integration test helpers
 *
 * CLEAN-UP ORDER MATTERS
 * Prisma enforces foreign key constraints. Delete child rows before parents:
 *   Token, RiderProfile, DriverProfile → User
 *   Payment, RideStateTransition      → Ride
 */

const prisma = require('../../config/prisma')

/**
 * Wipe all application data from the test database.
 * Call in beforeEach so each test starts from a known-empty state.
 */
async function cleanDb() {
    // Child tables first
    await prisma.token.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.rideStateTransition.deleteMany()
    await prisma.ride.deleteMany()
    await prisma.driverLocation.deleteMany()
    await prisma.driverProfile.deleteMany()
    await prisma.riderProfile.deleteMany()
    await prisma.suspension.deleteMany()
    await prisma.user.deleteMany()
}

/**
 * Seed a fully-verified RIDER user and return the raw credentials alongside
 * the created user record. Tests that need to log in call this instead of
 * going through the full register → verify-email flow.
 *
 * @param {object} [overrides] — partial user fields to override defaults
 * @returns {{ email, password, user }}
 */
async function seedVerifiedRider(overrides = {}) {
    const bcrypt = require('bcryptjs')

    const email    = overrides.email    ?? 'rider@integration.test'
    const password = overrides.password ?? 'Password1!'
    const hashed   = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
        data: {
            email,
            password:       hashed,
            name:           overrides.name  ?? 'Integration Rider',
            role:           'RIDER',
            emailVerifiedAt: new Date(),
            riderProfile: { create: {} },
        },
        include: { riderProfile: true },
    })

    return { email, password, user }
}

module.exports = { cleanDb, seedVerifiedRider }
