const { AppError } = require('../errors')

class RideStateMachine {
    static STATES = {
        REQUESTED: 'REQUESTED',
        ACCEPTED: 'ACCEPTED',
        DRIVER_ARRIVING: 'DRIVER_ARRIVING',
        IN_PROGRESS: 'IN_PROGRESS',
        COMPLETED: 'COMPLETED',
        CANCELLED: 'CANCELLED',
    }

    static TRANSITIONS = {
        REQUESTED:       ['ACCEPTED', 'CANCELLED'],
        ACCEPTED:        ['DRIVER_ARRIVING', 'CANCELLED'],
        DRIVER_ARRIVING: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS:     ['COMPLETED', 'CANCELLED'],
        COMPLETED:       [],
        CANCELLED:       [],
    }

    static validateTransition(from, to) {
        const allowed = RideStateMachine.TRANSITIONS[from]
        if (!allowed || !allowed.includes(to)) {
            throw new AppError(`Invalid ride state transition: ${from} → ${to}`, 409)
        }
    }
}

module.exports = RideStateMachine
