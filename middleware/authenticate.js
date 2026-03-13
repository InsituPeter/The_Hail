const { AuthorizationError } = require('../errors')

const authenticate = (authService) => (req, res, next) => {
    const header = req.headers['authorization']
    if (!header || !header.startsWith('Bearer ')) {
        return next(new AuthorizationError('Access token required'))
    }
    const token = header.split(' ')[1]
    try {
        req.user = authService.verifyAccessToken(token)
        next()
    } catch (err) {
        next(err)
    }
}

module.exports = authenticate
