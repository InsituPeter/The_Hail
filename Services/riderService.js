const { NotFoundError, ConflictError } = require('../errors')

class RiderService {
    constructor(riderRepository, paymentService, config) {
        this.riderRepository = riderRepository
        this.paymentService = paymentService
        this.config = config
    }

    async createProfile(userId) {
        const existing = await this.riderRepository.findByUserId(userId)
        if (existing) throw new ConflictError('Rider profile already exists')
        return await this.riderRepository.create(userId)
    }

    async getProfile(userId) {
        const profile = await this.riderRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Rider profile')
        return profile
    }

    async setupPaymentMethod(userId, email) {
        const profile = await this.riderRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Rider profile')

        const callbackUrl = `${this.config.frontend.url}/payment/verify`

        // ₦100 verification charge — refund manually from dashboard if desired
        const { authorizationUrl, reference } = await this.paymentService.initializeTransaction(
            email,
            100,
            callbackUrl
        )

        return { authorizationUrl, reference }
    }

    async verifyPaymentMethod(userId, reference) {
        const profile = await this.riderRepository.findByUserId(userId)
        if (!profile) throw new NotFoundError('Rider profile')

        const { authorizationCode, email } = await this.paymentService.verifyTransaction(reference)
        await this.riderRepository.updatePaymentMethod(userId, authorizationCode, email)

        return { message: 'Card saved successfully' }
    }
}

module.exports = RiderService
