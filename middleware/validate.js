const { ValidationError } = require('../errors')

const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
        const message = result.error.issues
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join('; ')
        return next(new ValidationError(message))
    }
    req.body = result.data
    next()
}

module.exports = validate
