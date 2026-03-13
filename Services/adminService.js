const { NotFoundError, ConflictError } = require('../errors')

class AdminService {
    constructor(adminRepository, driverRepository) {
        this.adminRepository = adminRepository
        this.driverRepository = driverRepository
    }

    // ─── Drivers ──────────────────────────────────────────────────────────────

    async listPendingDrivers() {
        return await this.adminRepository.listPendingDrivers()
    }

    async approveDriver(driverProfileId) {
        const driver = await this.driverRepository.findById(driverProfileId)
        if (!driver) throw new NotFoundError('Driver profile')
        if (driver.approvalState !== 'PENDING_REVIEW') {
            throw new ConflictError(`Driver is already ${driver.approvalState.toLowerCase()}`)
        }
        return await this.adminRepository.approveDriver(driverProfileId)
    }

    async rejectDriver(driverProfileId) {
        const driver = await this.driverRepository.findById(driverProfileId)
        if (!driver) throw new NotFoundError('Driver profile')
        if (driver.approvalState !== 'PENDING_REVIEW') {
            throw new ConflictError(`Driver is already ${driver.approvalState.toLowerCase()}`)
        }
        return await this.adminRepository.rejectDriver(driverProfileId)
    }

    // ─── Users ────────────────────────────────────────────────────────────────

    async listUsers(filters) {
        return await this.adminRepository.listUsers(filters)
    }

    async suspendUser(userId, reason, adminUserId) {
        return await this.adminRepository.suspendUser(userId, reason, adminUserId)
    }

    async liftSuspension(suspensionId, adminUserId) {
        return await this.adminRepository.liftSuspension(suspensionId, adminUserId)
    }

    // ─── Rides ────────────────────────────────────────────────────────────────

    async listRides(filters) {
        return await this.adminRepository.listRides(filters)
    }
}

module.exports = AdminService
