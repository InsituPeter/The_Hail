const express = require('express')
const router = express.Router()

module.exports = (webhookController) => {
    router.post('/paystack', express.raw({ type: 'application/json' }), webhookController.handlePaystackWebhook)
    return router
}
