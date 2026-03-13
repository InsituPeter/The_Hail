const express = require('express')
const router = express.Router()

const authenticate = require('../middleware/authenticate')
const validate = require('../middleware/validate')
const { updateUserSchema } = require('../validation/userSchemas')

module.exports = (authService, userController) => {
    const auth = authenticate(authService)

    router.get('/:userId', auth, userController.getUserById)
    router.patch('/:userId', auth, validate(updateUserSchema), userController.updateUser)
    router.delete('/:userId', auth, userController.deleteUser)

    return router
}
