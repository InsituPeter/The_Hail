class RiderController {
    constructor(riderService) {
        this.riderService = riderService
    }

    getProfile = async (req, res) => {
        const profile = await this.riderService.getProfile(req.user.userId)
        res.status(200).json({ profile })
    }

    setupPaymentMethod = async (req, res) => {
        const { email } = req.body
        const result = await this.riderService.setupPaymentMethod(req.user.userId, email)
        res.status(200).json(result)
    }

    verifyPaymentMethod = async (req, res) => {
        const { reference } = req.query
        const result = await this.riderService.verifyPaymentMethod(req.user.userId, reference)
        res.status(200).json(result)
    }
}

module.exports = RiderController
