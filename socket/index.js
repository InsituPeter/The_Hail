const { Server } = require('socket.io')
const redis = require('../config/redis')
const config = require('../config')
const logger = require('../config/logger')

const CHANNEL = 'hail:events'

let io = null

const createSocketServer = (httpServer, authService) => {
    io = new Server(httpServer, {
        cors: { origin: config.frontend.url, credentials: true }
    })

    // ─── Auth middleware ───────────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token
        if (!token) return next(new Error('Unauthorized'))
        try {
            socket.user = authService.verifyAccessToken(token)
            next()
        } catch {
            next(new Error('Unauthorized'))
        }
    })

    // ─── Connection handler ────────────────────────────────────────────
    io.on('connection', (socket) => {
        const { userId } = socket.user
        socket.join(`user:${userId}`)
        logger.info({ userId }, 'Socket connected')

        socket.on('disconnect', () => {
            logger.info({ userId }, 'Socket disconnected')
        })
    })

    // ─── Redis subscriber ──────────────────────────────────────────────
    const subscriber = redis.duplicate()

    subscriber.subscribe(CHANNEL, (err) => {
        if (err) logger.error({ err }, 'Redis subscribe failed')
    })

    subscriber.on('message', (channel, message) => {
        try {
            const { userId, event, data } = JSON.parse(message)
            if (io) io.to(`user:${userId}`).emit(event, data)
        } catch (err) {
            logger.error({ err }, 'Failed to process pub/sub message')
        }
    })

    return io
}

const emitToUser = (userId, event, data) => {
    redis.publish(CHANNEL, JSON.stringify({ userId, event, data }))
}

const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized')
    return io
}

module.exports = { createSocketServer, emitToUser, getIO }
