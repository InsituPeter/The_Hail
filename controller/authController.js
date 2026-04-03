const { AuthorizationError } = require('../errors')

class AuthController {
    constructor(authService, userService) {
        this.authService = authService
        this.userService = userService
    }

    register = async (req, res) => {
        const { email, password, name, phone, role } = req.body
        const user = await this.userService.createUser({ email, password, name, phone, role })
        await this.authService.sendVerificationEmail(user.userId)
        res.status(201).json({ message: 'Registration successful. Please verify your email.' })
    }

    login = async (req, res) => {
        const { email, password } = req.body
        const ipAddress = req.ip
        const userAgent = req.headers['user-agent']
        const { user, accessToken, refreshToken } = await this.authService.login(email, password, ipAddress, userAgent)

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({ data: { user, accessToken } })
    }

    refresh = async (req, res, next) => {
        const rawToken = req.cookies?.refreshToken
        if (!rawToken) return next(new AuthorizationError('Refresh token missing'))

        const ipAddress = req.ip
        const userAgent = req.headers['user-agent']
        const { accessToken, refreshToken } = await this.authService.refreshAccessToken(rawToken, ipAddress, userAgent)

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })

        res.status(200).json({ data: { accessToken } })
    }

    logout = async (req, res) => {
        const rawToken = req.cookies?.refreshToken
        if (rawToken) await this.authService.logout(rawToken)
        res.clearCookie('refreshToken')
        res.status(200).json({ message: 'Logged out successfully' })
    }

    verifyEmail = async (req, res) => {
        const { token } = req.query
        await this.authService.verifyEmailToken(token)
        res.status(200).json({ message: 'Email verified successfully' })
    }

    forgotPassword = async (req, res) => {
        const { email } = req.body
        await this.authService.forgotPassword(email)
        res.status(200).json({ message: 'If an account exists with that email, a reset link has been sent.' })
    }

    resetPassword = async (req, res) => {
        const { token, password } = req.body
        await this.authService.resetPassword(token, password)
        res.status(200).json({ message: 'Password reset successfully' })
    }
}

module.exports = AuthController
