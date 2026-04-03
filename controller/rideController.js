const { emitToUser } = require('../socket')

class RideController {
    constructor(rideService) {
        this.rideService = rideService
    }

    estimateFare = async (req, res) => {
        const result = await this.rideService.estimateFare(req.body)
        res.status(200).json({ data: result })
    }

    requestRide = async (req, res) => {
        const { ride } = await this.rideService.requestRide(req.user.userId, req.body)
        res.status(201).json({ data: { ride } })
    }

    acceptRide = async (req, res) => {
        const ride = await this.rideService.acceptRide(req.user.userId, parseInt(req.params.rideId))
        emitToUser(ride.rider.user.userId, 'ride:accepted', { rideId: ride.rideId })
        res.status(200).json({ data: { ride } })
    }

    arriveAtPickup = async (req, res) => {
        const ride = await this.rideService.arriveAtPickup(req.user.userId, parseInt(req.params.rideId))
        emitToUser(ride.rider.user.userId, 'ride:driver_arriving', { rideId: ride.rideId })
        res.status(200).json({ data: { ride } })
    }

    startRide = async (req, res) => {
        const ride = await this.rideService.startRide(req.user.userId, parseInt(req.params.rideId))
        emitToUser(ride.rider.user.userId, 'ride:started', { rideId: ride.rideId })
        res.status(200).json({ data: { ride } })
    }

    completeRide = async (req, res) => {
        const { finalFare, paymentMethod } = req.body
        const ride = await this.rideService.completeRide(req.user.userId, parseInt(req.params.rideId), finalFare, paymentMethod)
        emitToUser(ride.rider.user.userId, 'ride:completed', { rideId: ride.rideId, finalFare: ride.finalFare })
        res.status(200).json({ data: { ride } })
    }

    cancelRide = async (req, res) => {
        const { reason } = req.body
        const ride = await this.rideService.cancelRide(req.user.userId, parseInt(req.params.rideId), reason)
        emitToUser(ride.rider.user.userId, 'ride:cancelled', { rideId: ride.rideId, reason })
        if (ride.driver) {
            emitToUser(ride.driver.userId, 'ride:cancelled', { rideId: ride.rideId, reason })
        }
        res.status(200).json({ data: { ride } })
    }

    getRide = async (req, res) => {
        const ride = await this.rideService.getRide(parseInt(req.params.rideId))
        res.status(200).json({ data: { ride } })
    }
}

module.exports = RideController
