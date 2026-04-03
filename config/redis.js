const Redis = require('ioredis')
const config = require('./index')
const logger = require('./logger')

const redis = new Redis(config.redis.url)

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.error({ err }, 'Redis error'))

module.exports = redis
