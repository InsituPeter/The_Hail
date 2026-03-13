const express = require('express')
const router = express.Router()

const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const validate = require('../middleware/validate')
const {
    createDriverProfileSchema,
    updateDriverProfileSchema,
    availabilitySchema,
    locationSchema,
    payoutAccountSchema,
} = require('../validation/driverSchemas')

module.exports = (authService, driverController) => {
    const auth = authenticate(authService)
    const driverOnly = authorize(['DRIVER'])

    router.post('/', auth, driverOnly, validate(createDriverProfileSchema), driverController.createProfile)
    router.get('/me', auth, driverOnly, driverController.getProfile)
    router.patch('/me', auth, driverOnly, validate(updateDriverProfileSchema), driverController.updateProfile)
    router.patch('/me/availability', auth, driverOnly, validate(availabilitySchema), driverController.setAvailability)
    router.patch('/me/location', auth, driverOnly, validate(locationSchema), driverController.updateLocation)
    router.post('/me/payout-account', auth, driverOnly, validate(payoutAccountSchema), driverController.setupPayoutAccount)

    return router
}
