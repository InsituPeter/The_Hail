const redis = require('../config/redis')
const { NotFoundError, ConflictError, ForbiddenError } = require('../errors')

const GEO_KEY = 'drivers:available'
const ACTIVE_RIDE_STATES = ['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS']

class DriverService {
    constructor(driverRepository, rideRepository, paymentService) {
        this.driverRepository = driverRepository
        this.rideRepository = rideRepository
        this.paymentService = paymentService
    }

    async createProfile(userId, data) {
        const existing = await this.driverRepository.findByUserId(userId)
        if (existing) throw new ConflictError('Driver profile already exists')
        return await this.driverRepository.create(userId, data)
    }

    async getProfile(userId) {
        const profile = await this.driverRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Driver profile')
        return profile
    }

    async updateProfile(userId, data) {
        const profile = await this.driverRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Driver profile')
        return await this.driverRepository.updateProfile(profile.driverProfileId, data)
    }

    async setAvailability(userId, isAvailable) {
        const profile = await this.driverRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Driver profile')
        if (profile.approvalState !== 'APPROVED') {
            throw new ForbiddenError('Driver profile is not approved')
        }

        await this.driverRepository.updateAvailability(profile.driverProfileId, isAvailable)

        if (!isAvailable) {
            await redis.zrem(GEO_KEY, profile.driverProfileId.toString())
        }

        return { isAvailable }
    }

    async updateLocation(userId, lat, lng, heading) {
        const profile = await this.driverRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Driver profile')

        await this.driverRepository.upsertLocation(profile.driverProfileId, lat, lng, heading)

        if (profile.isAvailable && profile.approvalState === 'APPROVED') {
            await redis.geoadd(GEO_KEY, lng, lat, profile.driverProfileId.toString())
        }

        // Find active ride to notify the rider
        const activeRide = await this.rideRepository.findActiveByDriver(profile.driverProfileId)
        const activeRiderUserId = activeRide?.rider?.user?.userId ?? null

        return { result: { lat, lng, heading }, activeRiderUserId }
    }

    async setupPayoutAccount(userId, { businessName, settlementBank, accountNumber }) {
        const profile = await this.driverRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Driver profile')

        const { subaccountCode } = await this.paymentService.createSubaccount({
            businessName,
            settlementBank,
            accountNumber,
            percentageCharge: 90,   // driver receives 90% of each charge
        })

        await this.driverRepository.updateProfile(profile.driverProfileId, {
            paystackSubaccountCode: subaccountCode,
        })

        return { subaccountCode }
    }

    async findNearby(lat, lng, radiusKm, vehicleType) {
        const results = await redis.geosearch(
            GEO_KEY,
            'FROMLONLAT', lng, lat,
            'BYRADIUS', radiusKm, 'km',
            'ASC',
            'COUNT', 10
        )

        if (!results.length) return []

        const ids = results.map(id => parseInt(id))
        const drivers = await this.driverRepository.findManyByIds(ids)

        if (vehicleType) {
            return drivers.filter(d => d.vehicleType === vehicleType)
        }

        return drivers
    }
}

module.exports = DriverService
