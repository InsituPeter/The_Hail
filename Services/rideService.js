const { NotFoundError, ForbiddenError, ConflictError } = require('../errors')

const FARE_TABLE = {
    ECONOMY: { base: 500,  rate: 150 },   // ₦500 base + ₦150/km
    COMFORT:  { base: 800,  rate: 225 },   // ₦800 base + ₦225/km
    XL:       { base: 1200, rate: 300 },   // ₦1200 base + ₦300/km
}

class RideService {
    constructor(rideRepository, riderRepository, driverRepository, paymentRepository, mapsService, paymentService) {
        this.rideRepository = rideRepository
        this.riderRepository = riderRepository
        this.driverRepository = driverRepository
        this.paymentRepository = paymentRepository
        this.mapsService = mapsService
        this.paymentService = paymentService
    }

    _calculateFare(distanceKm, vehicleType) {
        const { base, rate } = FARE_TABLE[vehicleType]
        return parseFloat((base + distanceKm * rate).toFixed(2))
    }

    async estimateFare({ pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType }) {
        const { distanceKm, durationMin } = await this.mapsService.getDistanceAndDuration(
            pickupLat, pickupLng, dropoffLat, dropoffLng
        )
        const estimatedFare = this._calculateFare(distanceKm, vehicleType)
        return { distanceKm, durationMin, estimatedFare, vehicleType }
    }

    async requestRide(userId, data) {
        const riderProfile = await this.riderRepository.findByUserId(userId)
        if (!riderProfile) throw new NotFoundError('Rider profile')

        if (data.paymentMethod === 'CARD' && !riderProfile.paystackAuthorizationCode) {
            throw new ForbiddenError('Add a card before requesting a card payment ride')
        }

        const { distanceKm } = await this.mapsService.getDistanceAndDuration(
            data.pickupLat, data.pickupLng, data.dropoffLat, data.dropoffLng
        )
        const estimatedFare = this._calculateFare(distanceKm, data.vehicleType)

        const ride = await this.rideRepository.create({
            riderId: riderProfile.riderProfileId,
            state: 'REQUESTED',
            estimatedFare,
            paymentMethod: data.paymentMethod,
            pickupAddress: data.pickupAddress,
            pickupLat: data.pickupLat,
            pickupLng: data.pickupLng,
            dropoffAddress: data.dropoffAddress,
            dropoffLat: data.dropoffLat,
            dropoffLng: data.dropoffLng,
            vehicleType: data.vehicleType,
        })

        return { ride }
    }

    async acceptRide(userId, rideId) {
        const driverProfile = await this.driverRepository.findByUserId(userId)
        if (!driverProfile) throw new NotFoundError('Driver profile')
        if (!driverProfile.isAvailable) throw new ForbiddenError('Driver is not available')

        const ride = await this.rideRepository.findById(rideId)
        if (!ride) throw new NotFoundError('Ride')

        // CARD rides require the driver to have a Paystack subaccount to receive funds
        if (ride.paymentMethod === 'CARD' && !driverProfile.paystackSubaccountCode) {
            throw new ForbiddenError('Complete bank account setup to accept card rides')
        }

        const accepted = await this.rideRepository.accept(rideId, driverProfile.driverProfileId, userId)
        if (!accepted) throw new ConflictError('Ride is no longer available')

        return await this.rideRepository.findById(rideId)
    }

    async arriveAtPickup(userId, rideId) {
        await this._getDriverRide(userId, rideId)
        return await this.rideRepository.transitionState(rideId, 'DRIVER_ARRIVING', {}, userId)
    }

    async startRide(userId, rideId) {
        await this._getDriverRide(userId, rideId)
        return await this.rideRepository.transitionState(rideId, 'IN_PROGRESS', { pickupAt: new Date() }, userId)
    }

    async completeRide(userId, rideId, finalFare, paymentMethod) {
        const driverProfile = await this.driverRepository.findByUserId(userId)
        if (!driverProfile) throw new NotFoundError('Driver profile')

        const currentRide = await this._getDriverRide(userId, rideId)

        // Validate that the caller-supplied paymentMethod matches what was agreed at request time
        if (paymentMethod !== currentRide.paymentMethod) {
            throw new ForbiddenError('Payment method does not match the ride')
        }

        if (paymentMethod === 'CARD' && !currentRide.rider.paystackAuthorizationCode) {
            throw new ForbiddenError('Rider has no card on file')
        }

        const ride = await this.rideRepository.transitionState(rideId, 'COMPLETED', {
            finalFare,
            completedAt: new Date()
        }, userId)

        if (paymentMethod === 'CARD') {
            // Create PENDING record before charging — ensures a record exists even if the
            // charge call or DB update below fails, so the ride is never left unrecorded.
            await this.paymentRepository.create(rideId, finalFare, 'CARD')
            const { reference } = await this.paymentService.chargeAuthorization(
                currentRide.rider.paystackAuthorizationCode,
                currentRide.rider.paystackEmail,
                finalFare,
                driverProfile.paystackSubaccountCode
            )
            await this.paymentRepository.capture(rideId, finalFare, reference)
        } else {
            await this.paymentRepository.create(rideId, finalFare, 'CASH')
            await this.paymentRepository.capture(rideId, finalFare)
        }

        return ride
    }

    async cancelRide(userId, rideId, reason) {
        const ride = await this.rideRepository.findById(rideId)
        if (!ride) throw new NotFoundError('Ride')

        const isRider = ride.rider.user.userId === userId
        const isDriver = ride.driver?.userId === userId
        if (!isRider && !isDriver) throw new ForbiddenError('You are not a participant of this ride')

        // No funds were held with Paystack, so no cancellation API call needed.
        // Mark any pending CARD payment as FAILED so the record is clean.
        const payment = await this.paymentRepository.findByRideId(rideId)
        if (payment?.method === 'CARD' && payment?.state === 'PENDING') {
            await this.paymentRepository.fail(rideId)
        }

        return await this.rideRepository.transitionState(rideId, 'CANCELLED', {
            cancellationReason: reason,
            cancelledAt: new Date()
        }, userId)
    }

    async getRide(rideId) {
        const ride = await this.rideRepository.findById(rideId)
        if (!ride) throw new NotFoundError('Ride')
        return ride
    }

    async _getDriverRide(userId, rideId) {
        const driverProfile = await this.driverRepository.findByUserId(userId)
        if (!driverProfile) throw new NotFoundError('Driver profile')

        const ride = await this.rideRepository.findById(rideId)
        if (!ride) throw new NotFoundError('Ride')
        if (ride.driverProfileId !== driverProfile.driverProfileId) {
            throw new ForbiddenError('You are not assigned to this ride')
        }
        return ride
    }
}

module.exports = RideService
