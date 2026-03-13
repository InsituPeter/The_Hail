const cron = require('node-cron')
const logger = require('../config/logger')

function startTokenCleanup(tokenRepository) {
    // Runs every day at 02:00
    cron.schedule('0 2 * * *', async () => {
        try {
            const { count } = await tokenRepository.deleteStale()
            logger.info({ count }, 'Token cleanup complete')
        } catch (err) {
            logger.error({ err }, 'Token cleanup failed')
        }
    })

    logger.info('Token cleanup job scheduled (daily at 02:00)')
}

module.exports = { startTokenCleanup }
