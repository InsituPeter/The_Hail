const express = require('express')
const router = express.Router()

const validate = require('../middleware/validate')
const { authLimiter } = require('../middleware/rateLimiter')
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/authSchemas')

module.exports = (authController) => {
    router.post('/register', authLimiter, validate(registerSchema), authController.register)
    router.post('/login', authLimiter, validate(loginSchema), authController.login)
    router.post('/refresh', authController.refresh)
    router.post('/logout', authController.logout)
    router.get('/verify-email', authController.verifyEmail)
    router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword)
    router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword)

    return router
}
