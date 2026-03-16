const prisma = require('../config/prisma')
const RideStateMachine = require('../Domain/RideStateMachine')

class RideRepository {
    async create(data) {
        return await prisma.$transaction(async (tx) => {
            const ride = await tx.ride.create({ data })
            await tx.rideStateTransition.create({
                data: { rideId: ride.rideId, fromState: null, toState: ride.state }
            })
            return await tx.ride.findUnique({
                where: { rideId: ride.rideId },
                include: {
                    rider: { include: { user: { select: { userId: true } } } },
                    driver: true,
                    payment: true,
                }
            })
        })
    }

    async findById(rideId) {
        return await prisma.ride.findUnique({
            where: { rideId },
            include: {
                rider: { include: { user: { select: { userId: true } } } },
                driver: true,
                payment: true,
            }
        })
    }

    async findByRider(riderId) {
        return await prisma.ride.findMany({
            where: { riderId },
            orderBy: { createdAt: 'desc' },
            include: {
                rider: { include: { user: { select: { userId: true } } } },
                driver: true,
                payment: true,
            }
        })
    }

    async findByDriver(driverProfileId) {
        return await prisma.ride.findMany({
            where: { driverProfileId },
            orderBy: { createdAt: 'desc' },
            include: {
                rider: { include: { user: { select: { userId: true } } } },
                driver: true,
                payment: true,
            }
        })
    }

    async findActiveByDriver(driverProfileId) {
        return await prisma.ride.findFirst({
            where: {
                driverProfileId,
                state: { in: ['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'] }
            },
            include: { rider: { include: { user: { select: { userId: true } } } } }
        })
    }

    // Compare-and-swap: only succeeds if ride is still REQUESTED
    async accept(rideId, driverProfileId, userId) {
        return await prisma.$transaction(async (tx) => {
            const result = await tx.ride.updateMany({
                where: { rideId, state: 'REQUESTED' },
                data: { driverProfileId, state: 'ACCEPTED', acceptedAt: new Date() }
            })
            if (result.count === 1) {
                await tx.rideStateTransition.create({
                    data: { rideId, fromState: 'REQUESTED', toState: 'ACCEPTED', performedBy: userId }
                })
            }
            return result.count === 1
        })
    }

    async transitionState(rideId, toState, extraData = {}, performedBy = null) {
        return await prisma.$transaction(async (tx) => {
            const ride = await tx.ride.findUnique({ where: { rideId } })
            if (!ride) throw new Error(`Ride ${rideId} not found`)

            RideStateMachine.validateTransition(ride.state, toState)

            await tx.rideStateTransition.create({
                data: { rideId, fromState: ride.state, toState, performedBy }
            })

            await tx.ride.update({
                where: { rideId },
                data: { state: toState, ...extraData }
            })

            return await tx.ride.findUnique({
                where: { rideId },
                include: {
                    rider: { include: { user: { select: { userId: true } } } },
                    driver: true,
                    payment: true,
                }
            })
        })
    }
}

module.exports = RideRepository
