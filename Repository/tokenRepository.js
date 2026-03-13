const prisma = require('../config/prisma')

class TokenRepository {
    async create(userId, hashedToken, expiresAt, ipAddress, userAgent, type) {
        return await prisma.token.create({
            data: {
                userId: parseInt(userId),
                token: hashedToken,
                type,
                expiresAt,
                ipAddress,
                userAgent,
                state: 'ACTIVE'
            }
        })
    }

    async findByToken(token) {
        return await prisma.token.findFirst({
            where: { token },
            include: {
                user: {
                    select: {
                        userId: true,
                        email: true,
                        name: true,
                        role: true,
                        emailVerifiedAt: true,
                        deletedAt: true,
                    }
                }
            }
        })
    }

    async revokeToken(token) {
        return await prisma.token.update({
            where: { token },
            data: { state: 'REVOKED' }
        })
    }

    async deleteStale() {
        return await prisma.token.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { state: { in: ['USED', 'REVOKED', 'EXPIRED'] } },
                ]
            }
        })
    }

    async findByUserId(userId) {
        return await prisma.token.findMany({
            where: {
                userId,
                type: 'REFRESH'
            }
        })
    }
}

module.exports = TokenRepository
