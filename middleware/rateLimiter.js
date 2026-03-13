const rateLimit = require('express-rate-limit')

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false,
})

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' } },
    standardHeaders: true,
    legacyHeaders: false,
})

module.exports = { authLimiter, generalLimiter }
