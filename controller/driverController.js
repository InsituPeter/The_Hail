const { emitToUser } = require('../socket')

class DriverController {
    constructor(driverService) {
        this.driverService = driverService
    }

    createProfile = async (req, res) => {
        const profile = await this.driverService.createProfile(req.user.userId, req.body)
        res.status(201).json({ data: { profile } })
    }

    getProfile = async (req, res) => {
        const profile = await this.driverService.getProfile(req.user.userId)
        res.status(200).json({ data: { profile } })
    }

    updateProfile = async (req, res) => {
        const profile = await this.driverService.updateProfile(req.user.userId, req.body)
        res.status(200).json({ data: { profile } })
    }

    setAvailability = async (req, res) => {
        const { isAvailable } = req.body
        const result = await this.driverService.setAvailability(req.user.userId, isAvailable)
        res.status(200).json({ data: result })
    }

    setupPayoutAccount = async (req, res) => {
        const result = await this.driverService.setupPayoutAccount(req.user.userId, req.body)
        res.status(200).json({ data: result })
    }

    updateLocation = async (req, res) => {
        const { lat, lng, heading } = req.body
        const { result, activeRiderUserId } = await this.driverService.updateLocation(req.user.userId, lat, lng, heading)

        if (activeRiderUserId) {
            emitToUser(activeRiderUserId, 'driver:location', { lat, lng, heading })
        }

        res.status(200).json({ data: result })
    }
}

module.exports = DriverController
