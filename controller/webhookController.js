class WebhookController {
    constructor(paymentService, paymentRepository) {
        this.paymentService = paymentService
        this.paymentRepository = paymentRepository
    }

    handlePaystackWebhook = async (req, res) => {
        const signature = req.headers['x-paystack-signature']

        let event
        try {
            event = this.paymentService.constructWebhookEvent(req.body, signature)
        } catch (err) {
            return res.status(400).json({ error: err.message })
        }

        const reference = event.data?.reference

        if (event.event === 'charge.success' && reference) {
            const payment = await this.paymentRepository.findByReference(reference)
            if (payment && payment.state !== 'CAPTURED') {
                await this.paymentRepository.capture(payment.rideId, payment.amount)
            }
        } else if (event.event === 'charge.failed' && reference) {
            const payment = await this.paymentRepository.findByReference(reference)
            if (payment) {
                await this.paymentRepository.fail(payment.rideId)
            }
        }

        res.status(200).json({ received: true })
    }
}

module.exports = WebhookController
