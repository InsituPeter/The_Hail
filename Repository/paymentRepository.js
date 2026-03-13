const prisma = require('../config/prisma')

class PaymentRepository {
    async create(rideId, amount, method, paystackReference = null) {
        return await prisma.payment.create({
            data: { rideId, amount, method, state: 'PENDING', paystackReference }
        })
    }

    async capture(rideId, finalAmount, paystackReference = null) {
        return await prisma.payment.update({
            where: { rideId },
            data: { state: 'CAPTURED', amount: finalAmount, ...(paystackReference && { paystackReference }) }
        })
    }

    async fail(rideId) {
        return await prisma.payment.update({
            where: { rideId },
            data: { state: 'FAILED' }
        })
    }

    async findByRideId(rideId) {
        return await prisma.payment.findUnique({ where: { rideId } })
    }

    async findByReference(paystackReference) {
        return await prisma.payment.findFirst({ where: { paystackReference } })
    }
}

module.exports = PaymentRepository
