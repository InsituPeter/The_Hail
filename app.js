const http = require('http')
const express = require('express')
const app = express()

const config = require('./config')
const logger = require('./config/logger')
const prisma = require('./config/prisma')
const redis = require('./config/redis')

const cookieParser = require('cookie-parser')
const { generalLimiter } = require('./middleware/rateLimiter')
const notFound = require('./middleware/notFound')
const errorHandler = require('./middleware/errorHandler')

const { authController, userController, driverController, riderController, rideController, webhookController, adminController, authService, tokenRepository } = require('./container')
const { startTokenCleanup } = require('./jobs/tokenCleanup')
const { createSocketServer } = require('./socket')

// Webhook route MUST be before express.json() — Paystack signature verification requires the raw Buffer body
app.use('/api/webhooks', require('./routes/webhookRoutes')(webhookController))

app.use(express.json())
app.use(cookieParser())
app.use(generalLimiter)

app.use('/api/auth', require('./routes/authRoutes')(authController))
app.use('/api/users', require('./routes/userRoutes')(authService, userController))
app.use('/api/drivers', require('./routes/driverRoutes')(authService, driverController))
app.use('/api/riders', require('./routes/riderRoutes')(authService, riderController))
app.use('/api/rides', require('./routes/rideRoutes')(authService, rideController))
app.use('/api/admin', require('./routes/adminRoutes')(authService, adminController))

app.use(notFound)
app.use(errorHandler)

const start = async () => {
    try {
        await prisma.$connect()
        await redis.ping()

        const server = http.createServer(app)
        createSocketServer(server, authService)
        startTokenCleanup(tokenRepository)

        server.listen(config.port, () => {
            logger.info(`Server listening on port ${config.port}`)
        })

        const shutdown = (signal) => {
            logger.info(`${signal} received — shutting down`)
            server.close(async () => {
                await prisma.$disconnect()
                await redis.quit()
                logger.info('Shutdown complete')
                process.exit(0)
            })
        }

        process.on('SIGTERM', () => shutdown('SIGTERM'))
        process.on('SIGINT', () => shutdown('SIGINT'))

    } catch (err) {
        logger.error({ err }, 'Startup failed')
        process.exit(1)
    }
}

start()
