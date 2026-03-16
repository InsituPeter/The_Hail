const express = require('express')
const router = express.Router()

const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const validate = require('../middleware/validate')
const idempotency = require('../middleware/idempotency')
const { requestRideSchema, estimateFareSchema, completeRideSchema, cancelRideSchema } = require('../validation/rideSchemas')

module.exports = (authService, rideController) => {
    const auth = authenticate(authService)
    const riderOnly = authorize(['RIDER'])
    const driverOnly = authorize(['DRIVER'])

    // Rider actions
    router.post('/estimate', auth, riderOnly, validate(estimateFareSchema), rideController.estimateFare)
    router.post('/', auth, riderOnly, validate(requestRideSchema), idempotency, rideController.requestRide)
    router.post('/:rideId/cancel', auth, riderOnly, validate(cancelRideSchema), rideController.cancelRide)
    router.get('/:rideId', auth, rideController.getRide)

    // Driver actions
    router.post('/:rideId/accept', auth, driverOnly, rideController.acceptRide)
    router.post('/:rideId/arrive', auth, driverOnly, rideController.arriveAtPickup)
    router.post('/:rideId/start', auth, driverOnly, rideController.startRide)
    router.post('/:rideId/complete', auth, driverOnly, validate(completeRideSchema), rideController.completeRide)

    return router
}
