const { randomUUID } = require('crypto')
const pinoHttp = require('pino-http')
const logger = require('../config/logger')

const httpLogger = pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    customLogLevel: (req, res) => {
        if (res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
    },
})

module.exports = httpLogger
