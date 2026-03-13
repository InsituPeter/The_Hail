const redis = require('../config/redis')

const IDEMPOTENCY_TTL = 86400 // 24 hours

const idempotency = async (req, res, next) => {
    const key = req.headers['x-idempotency-key']
    if (!key) return next()

    const redisKey = `idempotency:${key}`
    const cached = await redis.get(redisKey)

    if (cached) {
        const { status, body } = JSON.parse(cached)
        return res.status(status).json(body)
    }

    const originalJson = res.json.bind(res)
    res.json = (body) => {
        if (res.statusCode < 500) {
            redis.set(redisKey, JSON.stringify({ status: res.statusCode, body }), 'EX', IDEMPOTENCY_TTL)
        }
        return originalJson(body)
    }

    next()
}

module.exports = idempotency
