const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
    AuthorizationError,
    ConflictError,
} = require("../errors")
const config = require("../config/index")


class AuthService {
    constructor(userRepository, tokenRepository, emailService) {
        this.userRepository = userRepository
        this.tokenRepository = tokenRepository
        this.emailService = emailService
    }


    // ─── Token Helpers ────────────────────────────────────────────────

    generateAccessToken(payload) {
        return jwt.sign(payload, config.jwt.secret, { expiresIn: "3h" })
    }

    verifyAccessToken(token) {
        try {
            return jwt.verify(token, config.jwt.secret)
        } catch {
            throw new AuthorizationError('Invalid or expired access token')
        }
    }

    _hashToken(rawToken) {
        return crypto.createHash('sha256').update(rawToken).digest('hex')
    }

    _generateRawToken() {
        return crypto.randomBytes(64).toString('hex')
    }


    // ─── Refresh Token ────────────────────────────────────────────────

    async _generateRefreshToken(userId, ipAddress, userAgent) {
        const rawToken = this._generateRawToken()
        const hashedToken = this._hashToken(rawToken)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await this.tokenRepository.create(userId, hashedToken, expiresAt, ipAddress, userAgent, 'REFRESH')
        return rawToken
    }


    // ─── Auth Flows ───────────────────────────────────────────────────

    async login(email, password, ipAddress, userAgent) {
        const user = await this.userRepository.findByEmail(email)
        if (!user) throw new NotFoundError('Invalid credentials')

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) throw new ForbiddenError('Invalid credentials')

        if (user.suspended) throw new ForbiddenError('Account is suspended')
        if (user.deletedAt) throw new NotFoundError('Invalid credentials')

        const accessToken = this.generateAccessToken({
            userId: user.userId,
            email: user.email,
            role: user.role
        })
        const refreshToken = await this._generateRefreshToken(user.userId, ipAddress, userAgent)

        const { password: _, ...safeUser } = user
        return { user: safeUser, accessToken, refreshToken }
    }

    async refreshAccessToken(rawToken, ipAddress, userAgent) {
        const hashedToken = this._hashToken(rawToken)
        const stored = await this.tokenRepository.findByToken(hashedToken)

        if (!stored) throw new AuthorizationError('Invalid refresh token')
        if (stored.state !== 'ACTIVE') throw new AuthorizationError('Refresh token no longer valid')
        if (new Date() > stored.expiresAt) throw new AuthorizationError('Refresh token expired')

        await this.tokenRepository.revokeToken(hashedToken)

        const newRefreshToken = await this._generateRefreshToken(stored.user.userId, ipAddress, userAgent)
        const accessToken = this.generateAccessToken({
            userId: stored.user.userId,
            email: stored.user.email,
            role: stored.user.role
        })

        return { accessToken, refreshToken: newRefreshToken }
    }

    async logout(rawToken) {
        const hashedToken = this._hashToken(rawToken)
        const stored = await this.tokenRepository.findByToken(hashedToken)
        if (!stored) throw new AuthorizationError('Invalid token')
        await this.tokenRepository.revokeToken(hashedToken)
    }

    async logoutAllDevices(userId) {
        const tokens = await this.tokenRepository.findByUserId(userId)
        await Promise.all(
            tokens.map(t => this.tokenRepository.revokeToken(t.token))
        )
    }


    // ─── Email Verification ───────────────────────────────────────────

    async sendVerificationEmail(userId) {
        const user = await this.userRepository.findById(userId)
        if (!user) throw new NotFoundError('User')
        if (user.emailVerified) throw new ConflictError('Email already verified')

        const rawToken = this._generateRawToken()
        const hashedToken = this._hashToken(rawToken)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

        await this.tokenRepository.create(user.userId, hashedToken, expiresAt, null, null, 'EMAIL_VERIFICATION')
        await this.emailService.sendEmailVerification(user.email, user.name, rawToken)
    }

    async verifyEmailToken(rawToken) {
        const hashedToken = this._hashToken(rawToken)
        const stored = await this.tokenRepository.findByToken(hashedToken)

        if (!stored) throw new AuthorizationError('Invalid verification link')
        if (stored.type !== 'EMAIL_VERIFICATION') throw new AuthorizationError('Invalid token type')
        if (stored.state !== 'ACTIVE') throw new AuthorizationError('Verification link already used')
        if (new Date() > stored.expiresAt) throw new AuthorizationError('Verification link has expired')

        await this.tokenRepository.revokeToken(hashedToken)
        await this.userRepository.activateUser(stored.userId)
    }


    // ─── Password Reset ───────────────────────────────────────────────

    async forgotPassword(email) {
        const user = await this.userRepository.findByEmail(email)
        if (!user) throw new NotFoundError('No account associated with that email')

        const rawToken = this._generateRawToken()
        const hashedToken = this._hashToken(rawToken)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

        await this.tokenRepository.create(user.userId, hashedToken, expiresAt, null, null, 'PASSWORD_RESET')
        await this.emailService.sendPasswordResetEmail(user.email, user.name, rawToken)
    }

    async resetPassword(rawToken, newPassword) {
        const hashedToken = this._hashToken(rawToken)
        const stored = await this.tokenRepository.findByToken(hashedToken)

        if (!stored) throw new AuthorizationError('Invalid or expired reset link')
        if (stored.type !== 'PASSWORD_RESET') throw new AuthorizationError('Invalid token type')
        if (stored.state !== 'ACTIVE') throw new AuthorizationError('Reset link already used')
        if (new Date() > stored.expiresAt) throw new AuthorizationError('Reset link has expired')

        const hashed = await bcrypt.hash(newPassword, 10)
        await this.userRepository.updateProfile(stored.userId, { password: hashed })
        await this.tokenRepository.revokeToken(hashedToken)
        await this.logoutAllDevices(stored.userId)
    }
}
module.exports = AuthService
