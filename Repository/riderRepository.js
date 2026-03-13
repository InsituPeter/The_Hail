const prisma = require('../config/prisma')

class RiderRepository {
    async create(userId) {
        return await prisma.riderProfile.create({
            data: { userId }
        })
    }

    async findByUserId(userId) {
        return await prisma.riderProfile.findUnique({
            where: { userId }
        })
    }

    async updatePaymentMethod(userId, paystackAuthorizationCode, paystackEmail) {
        return await prisma.riderProfile.update({
            where: { userId },
            data: { paystackAuthorizationCode, paystackEmail }
        })
    }
}

module.exports = RiderRepository
