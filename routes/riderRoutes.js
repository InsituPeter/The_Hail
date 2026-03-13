const express = require('express')
const router = express.Router()

const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const validate = require('../middleware/validate')
const { setupPaymentMethodSchema } = require('../validation/riderSchemas')

module.exports = (authService, riderController) => {
    const auth = authenticate(authService)
    const riderOnly = authorize(['RIDER'])

    router.get('/me', auth, riderOnly, riderController.getProfile)
    router.post('/me/payment-method/setup', auth, riderOnly, validate(setupPaymentMethodSchema), riderController.setupPaymentMethod)
    router.get('/me/payment-method/verify', auth, riderOnly, riderController.verifyPaymentMethod)

    return router
}
