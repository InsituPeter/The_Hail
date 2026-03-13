const Redis = require('ioredis')
const config = require('./index')

const redis = new Redis(config.redis.url)

redis.on('connect', () => console.log('Redis connected'))
redis.on('error', (err) => console.error('Redis error', err))

module.exports = redis
