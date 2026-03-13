const express = require('express')
const router = express.Router()

const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const validate = require('../middleware/validate')
const { suspendUserSchema } = require('../validation/adminSchemas')

module.exports = (authService, adminController) => {
    const auth = authenticate(authService)
    const adminOnly = authorize(['ADMIN'])

    router.get('/drivers/pending', auth, adminOnly, adminController.listPendingDrivers)
    router.patch('/drivers/:id/approve', auth, adminOnly, adminController.approveDriver)
    router.patch('/drivers/:id/reject', auth, adminOnly, adminController.rejectDriver)

    router.get('/users', auth, adminOnly, adminController.listUsers)
    router.post('/users/:id/suspend', auth, adminOnly, validate(suspendUserSchema), adminController.suspendUser)
    router.patch('/suspensions/:id/lift', auth, adminOnly, adminController.liftSuspension)

    router.get('/rides', auth, adminOnly, adminController.listRides)

    return router
}
