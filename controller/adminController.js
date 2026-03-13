class AdminController {
    constructor(adminService) {
        this.adminService = adminService
    }

    // ─── Drivers ──────────────────────────────────────────────────────────────

    listPendingDrivers = async (req, res) => {
        const drivers = await this.adminService.listPendingDrivers()
        res.status(200).json({ drivers })
    }

    approveDriver = async (req, res) => {
        const driverProfileId = parseInt(req.params.id)
        const driver = await this.adminService.approveDriver(driverProfileId)
        res.status(200).json({ driver })
    }

    rejectDriver = async (req, res) => {
        const driverProfileId = parseInt(req.params.id)
        const driver = await this.adminService.rejectDriver(driverProfileId)
        res.status(200).json({ driver })
    }

    // ─── Users ────────────────────────────────────────────────────────────────

    listUsers = async (req, res) => {
        const { role, page } = req.query
        const result = await this.adminService.listUsers({
            role: role || undefined,
            page: page ? parseInt(page) : 1,
        })
        res.status(200).json(result)
    }

    suspendUser = async (req, res) => {
        const userId = parseInt(req.params.id)
        const { reason } = req.body
        const suspension = await this.adminService.suspendUser(userId, reason, req.user.userId)
        res.status(201).json({ suspension })
    }

    liftSuspension = async (req, res) => {
        const suspensionId = parseInt(req.params.id)
        const suspension = await this.adminService.liftSuspension(suspensionId, req.user.userId)
        res.status(200).json({ suspension })
    }

    // ─── Rides ────────────────────────────────────────────────────────────────

    listRides = async (req, res) => {
        const { state, page } = req.query
        const result = await this.adminService.listRides({
            state: state || undefined,
            page: page ? parseInt(page) : 1,
        })
        res.status(200).json(result)
    }
}

module.exports = AdminController
