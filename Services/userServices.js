const bcrypt = require('bcryptjs')
const { ValidationError, NotFoundError, ConflictError } = require('../errors')

class UserService {
    constructor(userRepository, emailService, riderRepository) {
        this.userRepository = userRepository
        this.emailService = emailService
        this.riderRepository = riderRepository
    }

    async createUser(data) {
        const { email, password, name, role, phone } = data
        if (!email || !password || !name || !role || !phone) {
            throw new ValidationError('All fields are required')
        }

        const exists = await this.userRepository.existByEmail(email)
        if (exists) throw new ConflictError('An account with this email already exists')

        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await this.userRepository.create({ email, password: hashedPassword, name, role, phone })

        if (role === 'RIDER') {
            await this.riderRepository.create(user.userId)
        }

        await this.emailService.sendWelcomeEmail(user.email, user.name)

        const { password: _, ...safeUser } = user
        return safeUser
    }

    async getUserById(userId) {
        const user = await this.userRepository.findById(userId)
        if (!user) throw new NotFoundError('User')
        const { password: _, ...safeUser } = user
        return safeUser
    }

    async getUserByEmail(email) {
        const user = await this.userRepository.findByEmail(email)
        if (!user) throw new NotFoundError('User')
        const { password: _, ...safeUser } = user
        return safeUser
    }

    async updateUser(userId, data) {
        const user = await this.userRepository.findById(userId)
        if (!user) throw new NotFoundError('User')

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10)
        }

        const updatedUser = await this.userRepository.updateProfile(userId, data)
        const { password: _, ...safeUser } = updatedUser
        return safeUser
    }

    async deleteUser(userId) {
        const user = await this.userRepository.findById(userId)
        if (!user) throw new NotFoundError('User')
        await this.userRepository.softDelete(userId)
    }
}

module.exports = UserService
