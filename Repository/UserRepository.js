const prisma = require('../config/prisma')
const { NotFoundError } = require('../errors')

class UserRepository {
    async create({ email, password, name, role, phone }) {
        return await prisma.user.create({
            data: { email: email.toLowerCase(), password, name, role, phone }
        })
    }

    async findByEmail(email) {
        return await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        })
    }

    async findById(userId) {
        return await prisma.user.findUnique({
            where: { userId: parseInt(userId) }
        })
    }

    async activateUser(userId) {
        return await prisma.user.update({
            where: { userId: parseInt(userId) },
            data: { emailVerifiedAt: new Date() }
        })
    }

    async updateProfile(userId, data) {
        return await prisma.user.update({
            where: { userId: parseInt(userId) },
            data: { ...data, version: { increment: 1 } }
        })
    }

    async softDelete(userId) {
        return await prisma.user.update({
            where: { userId: parseInt(userId) },
            data: { deletedAt: new Date() }
        })
    }

    async existByEmail(email) {
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { userId: true }
        })
        return !!user
    }
}

module.exports = UserRepository
