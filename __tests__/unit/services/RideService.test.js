/**
 * RideService — Unit Tests
 *
 * WHAT WE'RE TESTING
 * RideService contains the most complex business logic in the codebase:
 *   - Fare calculation (NGN amounts, three vehicle types)
 *   - Ride request guards (rider profile exists, card is set up)
 *   - Ride acceptance guards (driver available, subaccount set up for CARD)
 *   - Compare-and-swap protection against double-booking
 *   - Payment charging at completion (CASH vs CARD paths)
 *   - Payment cleanup on cancellation
 *
 * ABOUT THE SIX-PARAMETER CONSTRUCTOR
 * RideService takes six dependencies. Each mock is a plain object with
 * jest.fn() methods. We create them in beforeEach so every test gets a
 * clean slate — no return values or call counts from a previous test.
 *
 * ABOUT _calculateFare
 * This is a private method (prefixed with _) but it's still testable
 * directly because JavaScript has no true private methods on classes.
 * Testing it directly lets us verify the fare formula precisely without
 * going through the full requestRide flow.
 */

const RideService = require('../../../Services/rideService')
const { NotFoundError, ForbiddenError, ConflictError } = require('../../../errors')

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeRideRepository(overrides = {}) {
    return {
        create:          jest.fn(),
        findById:        jest.fn(),
        accept:          jest.fn(),
        transitionState: jest.fn(),
        ...overrides,
    }
}

function makeRiderRepository(overrides = {}) {
    return {
        findByUserId: jest.fn(),
        ...overrides,
    }
}

function makeDriverRepository(overrides = {}) {
    return {
        findByUserId: jest.fn(),
        ...overrides,
    }
}

function makePaymentRepository(overrides = {}) {
    return {
        create:      jest.fn(),
        capture:     jest.fn(),
        fail:        jest.fn(),
        findByRideId: jest.fn(),
        ...overrides,
    }
}

function makeMapsService(overrides = {}) {
    return {
        getDistanceAndDuration: jest.fn(),
        ...overrides,
    }
}

function makePaymentService(overrides = {}) {
    return {
        chargeAuthorization: jest.fn(),
        ...overrides,
    }
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const riderProfile = {
    riderProfileId:             1,
    userId:                     10,
    paystackAuthorizationCode:  'AUTH_xxx',
    paystackEmail:              'rider@test.com',
}

const riderProfileNoCard = {
    ...riderProfile,
    paystackAuthorizationCode: null,
    paystackEmail:             null,
}

const driverProfile = {
    driverProfileId:        2,
    userId:                 20,
    isAvailable:            true,
    approvalState:          'APPROVED',
    paystackSubaccountCode: 'ACCT_xxx',
}

const driverProfileNoSubaccount = {
    ...driverProfile,
    paystackSubaccountCode: null,
}

const unavailableDriver = { ...driverProfile, isAvailable: false }

const rideData = {
    pickupAddress:  '1 Lagos Street',
    pickupLat:      6.5,
    pickupLng:      3.3,
    dropoffAddress: '2 Abuja Road',
    dropoffLat:     6.6,
    dropoffLng:     3.4,
    vehicleType:    'ECONOMY',
    paymentMethod:  'CASH',
}

// A ride as returned by rideRepository.findById — includes rider + user
const storedRide = {
    rideId:          100,
    driverProfileId: 2,
    paymentMethod:   'CASH',
    state:           'ACCEPTED',
    rider: {
        userId: 10,
        paystackAuthorizationCode: 'AUTH_xxx',
        paystackEmail: 'rider@test.com',
        user: { userId: 10 },
    },
    driver: { userId: 20 },
}

// ─── _calculateFare() ─────────────────────────────────────────────────────────
//
// The fare formula is: base + (distanceKm × rate)
// We test all three vehicle types to confirm the fare table is wired correctly.

describe('RideService._calculateFare()', () => {
    let rideService

    beforeEach(() => {
        rideService = new RideService(
            makeRideRepository(), makeRiderRepository(), makeDriverRepository(),
            makePaymentRepository(), makeMapsService(), makePaymentService()
        )
    })

    it('calculates ECONOMY fare correctly', () => {
        // ₦500 base + (10km × ₦150) = ₦2000
        expect(rideService._calculateFare(10, 'ECONOMY')).toBe(2000)
    })

    it('calculates COMFORT fare correctly', () => {
        // ₦800 base + (5km × ₦225) = ₦1925
        expect(rideService._calculateFare(5, 'COMFORT')).toBe(1925)
    })

    it('calculates XL fare correctly', () => {
        // ₦1200 base + (0km × ₦300) = ₦1200
        expect(rideService._calculateFare(0, 'XL')).toBe(1200)
    })
})

// ─── requestRide() ────────────────────────────────────────────────────────────

describe('RideService.requestRide()', () => {
    let rideService, rideRepository, riderRepository, mapsService

    beforeEach(() => {
        rideRepository  = makeRideRepository()
        riderRepository = makeRiderRepository()
        mapsService     = makeMapsService()
        rideService     = new RideService(
            rideRepository, riderRepository, makeDriverRepository(),
            makePaymentRepository(), mapsService, makePaymentService()
        )

        mapsService.getDistanceAndDuration.mockResolvedValue({ distanceKm: 10, durationMin: 20 })
        rideRepository.create.mockResolvedValue({ rideId: 100, ...rideData })
    })

    it('throws NotFoundError when rider has no profile', async () => {
        riderRepository.findByUserId.mockResolvedValue(null)

        await expect(rideService.requestRide(10, rideData)).rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError when CARD requested but no authorization code saved', async () => {
        riderRepository.findByUserId.mockResolvedValue(riderProfileNoCard)

        await expect(
            rideService.requestRide(10, { ...rideData, paymentMethod: 'CARD' })
        ).rejects.toThrow(ForbiddenError)
    })

    it('creates and returns the ride for a CASH request', async () => {
        riderRepository.findByUserId.mockResolvedValue(riderProfile)

        const { ride } = await rideService.requestRide(10, rideData)

        expect(rideRepository.create).toHaveBeenCalledTimes(1)
        expect(ride.rideId).toBe(100)
    })

    it('creates the ride for a CARD request when authorization code exists', async () => {
        riderRepository.findByUserId.mockResolvedValue(riderProfile)

        const { ride } = await rideService.requestRide(10, { ...rideData, paymentMethod: 'CARD' })

        expect(rideRepository.create).toHaveBeenCalledTimes(1)
        expect(ride).toBeDefined()
    })

    it('stores paymentMethod on the created ride', async () => {
        riderRepository.findByUserId.mockResolvedValue(riderProfile)

        await rideService.requestRide(10, rideData)

        // The object passed to rideRepository.create must include paymentMethod
        expect(rideRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ paymentMethod: 'CASH' })
        )
    })
})

// ─── acceptRide() ─────────────────────────────────────────────────────────────

describe('RideService.acceptRide()', () => {
    let rideService, rideRepository, driverRepository

    beforeEach(() => {
        rideRepository  = makeRideRepository()
        driverRepository = makeDriverRepository()
        rideService     = new RideService(
            rideRepository, makeRiderRepository(), driverRepository,
            makePaymentRepository(), makeMapsService(), makePaymentService()
        )
    })

    it('throws NotFoundError when driver has no profile', async () => {
        driverRepository.findByUserId.mockResolvedValue(null)

        await expect(rideService.acceptRide(20, 100)).rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError when driver is not available', async () => {
        driverRepository.findByUserId.mockResolvedValue(unavailableDriver)

        await expect(rideService.acceptRide(20, 100)).rejects.toThrow(ForbiddenError)
    })

    it('throws NotFoundError when ride does not exist', async () => {
        driverRepository.findByUserId.mockResolvedValue(driverProfile)
        rideRepository.findById.mockResolvedValue(null)

        await expect(rideService.acceptRide(20, 100)).rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError when CARD ride but driver has no subaccount', async () => {
        driverRepository.findByUserId.mockResolvedValue(driverProfileNoSubaccount)
        rideRepository.findById.mockResolvedValue({ ...storedRide, paymentMethod: 'CARD' })

        await expect(rideService.acceptRide(20, 100)).rejects.toThrow(ForbiddenError)
    })

    it('throws ConflictError when another driver accepted first (CAS fails)', async () => {
        // Compare-and-swap: accept() returns false when the ride is no longer REQUESTED
        driverRepository.findByUserId.mockResolvedValue(driverProfile)
        rideRepository.findById.mockResolvedValue(storedRide)
        rideRepository.accept.mockResolvedValue(false)

        await expect(rideService.acceptRide(20, 100)).rejects.toThrow(ConflictError)
    })

    it('returns the full ride when acceptance succeeds', async () => {
        driverRepository.findByUserId.mockResolvedValue(driverProfile)
        rideRepository.findById.mockResolvedValue(storedRide)
        rideRepository.accept.mockResolvedValue(true)
        // findById is called again after accept to return the updated ride
        rideRepository.findById.mockResolvedValueOnce(storedRide).mockResolvedValueOnce(storedRide)

        const ride = await rideService.acceptRide(20, 100)

        expect(ride).toBeDefined()
        // accept() receives rideId, driverProfileId, AND the driver's userId (third arg)
        expect(rideRepository.accept).toHaveBeenCalledWith(100, driverProfile.driverProfileId, 20)
    })
})

// ─── completeRide() ───────────────────────────────────────────────────────────
//
// completeRide has two payment paths: CASH (create + capture immediately)
// and CARD (call chargeAuthorization, then create + capture).
// We test both to confirm neither path is silently skipped.

describe('RideService.completeRide()', () => {
    let rideService, rideRepository, driverRepository, riderRepository,
        paymentRepository, paymentService

    beforeEach(() => {
        rideRepository    = makeRideRepository()
        driverRepository  = makeDriverRepository()
        riderRepository   = makeRiderRepository()
        paymentRepository = makePaymentRepository()
        paymentService    = makePaymentService()

        rideService = new RideService(
            rideRepository, riderRepository, driverRepository,
            paymentRepository, makeMapsService(), paymentService
        )

        // _getDriverRide calls driverRepository.findByUserId + rideRepository.findById
        driverRepository.findByUserId.mockResolvedValue(driverProfile)
        rideRepository.findById.mockResolvedValue(storedRide)
        rideRepository.transitionState.mockResolvedValue(storedRide)
        paymentRepository.create.mockResolvedValue()
        paymentRepository.capture.mockResolvedValue()
    })

    it('creates and captures a CASH payment without calling chargeAuthorization', async () => {
        await rideService.completeRide(20, 100, 2000, 'CASH')

        expect(paymentService.chargeAuthorization).not.toHaveBeenCalled()
        expect(paymentRepository.create).toHaveBeenCalledWith(100, 2000, 'CASH')
        expect(paymentRepository.capture).toHaveBeenCalledWith(100, 2000)
    })

    it('calls chargeAuthorization and records a CARD payment', async () => {
        riderRepository.findByUserId.mockResolvedValue(riderProfile)
        paymentService.chargeAuthorization.mockResolvedValue({ reference: 'REF_abc' })

        await rideService.completeRide(20, 100, 2000, 'CARD')

        // rideService passes amounts in Naira — the kobo conversion (× 100) happens
        // inside paymentService.chargeAuthorization, not here.
        expect(paymentService.chargeAuthorization).toHaveBeenCalledWith(
            riderProfile.paystackAuthorizationCode,
            riderProfile.paystackEmail,
            2000,   // ₦2000 in Naira — kobo conversion is paymentService's responsibility
            driverProfile.paystackSubaccountCode
        )
        expect(paymentRepository.create).toHaveBeenCalledWith(100, 2000, 'CARD', 'REF_abc')
        expect(paymentRepository.capture).toHaveBeenCalledWith(100, 2000)
    })
})

// ─── cancelRide() ─────────────────────────────────────────────────────────────

describe('RideService.cancelRide()', () => {
    let rideService, rideRepository, paymentRepository

    beforeEach(() => {
        rideRepository    = makeRideRepository()
        paymentRepository = makePaymentRepository()

        rideService = new RideService(
            rideRepository, makeRiderRepository(), makeDriverRepository(),
            paymentRepository, makeMapsService(), makePaymentService()
        )

        rideRepository.transitionState.mockResolvedValue(storedRide)
    })

    it('throws NotFoundError when ride does not exist', async () => {
        rideRepository.findById.mockResolvedValue(null)

        await expect(rideService.cancelRide(10, 100, 'changed mind')).rejects.toThrow(NotFoundError)
    })

    it('marks a pending CARD payment as FAILED before cancelling', async () => {
        rideRepository.findById.mockResolvedValue(storedRide)
        paymentRepository.findByRideId.mockResolvedValue({ method: 'CARD', state: 'PENDING' })
        paymentRepository.fail.mockResolvedValue()

        await rideService.cancelRide(10, 100, 'changed mind')

        // No funds were held with Paystack, but we clean up the payment record
        expect(paymentRepository.fail).toHaveBeenCalledWith(100)
    })

    it('does not call paymentRepository.fail for a CASH ride', async () => {
        rideRepository.findById.mockResolvedValue(storedRide)
        paymentRepository.findByRideId.mockResolvedValue({ method: 'CASH', state: 'PENDING' })

        await rideService.cancelRide(10, 100, 'changed mind')

        expect(paymentRepository.fail).not.toHaveBeenCalled()
    })
})
