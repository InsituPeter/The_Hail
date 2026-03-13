const { AppError } = require('../errors')
const logger = require('../config/logger')

const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.name,
                message: err.message,
                ...(err.errorCode && { errorCode: err.errorCode }),
                timestamp: err.timestamp,
            }
        })
    }

    logger.error(err)
    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
        }
    })
}


module.exports=errorHandler