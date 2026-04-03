const http = require('http')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const app = express()

const config = require('./config')
const logger = require('./config/logger')
const prisma = require('./config/prisma')
const redis = require('./config/redis')

const cookieParser = require('cookie-parser')
const httpLogger = require('./middleware/httpLogger')
const { generalLimiter } = require('./middleware/rateLimiter')
const notFound = require('./middleware/notFound')
const errorHandler = require('./middleware/errorHandler')

const { authController, userController, driverController, riderController, rideController, webhookController, adminController, authService, tokenRepository } = require('./container')
const { startTokenCleanup } = require('./jobs/tokenCleanup')
const { createSocketServer } = require('./socket')

app.use(cors({ origin: config.frontend.url, credentials: true }))
app.use(helmet())
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Webhook route MUST be before express.json() — Paystack signature verification requires the raw Buffer body
app.use('/api/v1/webhooks', require('./routes/webhookRoutes')(webhookController))

app.use(httpLogger)
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.use(generalLimiter)

app.use('/api/v1/auth', require('./routes/authRoutes')(authController))
app.use('/api/v1/users', require('./routes/userRoutes')(authService, userController))
app.use('/api/v1/drivers', require('./routes/driverRoutes')(authService, driverController))
app.use('/api/v1/riders', require('./routes/riderRoutes')(authService, riderController))
app.use('/api/v1/rides', require('./routes/rideRoutes')(authService, rideController))
app.use('/api/v1/admin', require('./routes/adminRoutes')(authService, adminController))

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

// Allow importing the configured Express app without starting the HTTP server
// (used by integration tests via supertest).
module.exports = { app }

if (require.main === module) {
    start()
}
