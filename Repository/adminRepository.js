const prisma = require('../config/prisma')

const PAGE_SIZE = 20

class AdminRepository {

    // ─── Drivers ──────────────────────────────────────────────────────────────

    async listPendingDrivers() {
        return await prisma.driverProfile.findMany({
            where: { approvalState: 'PENDING_REVIEW' },
            include: { user: { select: { userId: true, name: true, email: true, phone: true } } },
            orderBy: { createdAt: 'asc' },
        })
    }

    async approveDriver(driverProfileId) {
        return await prisma.driverProfile.update({
            where: { driverProfileId },
            data: { approvalState: 'APPROVED' },
        })
    }

    async rejectDriver(driverProfileId) {
        return await prisma.driverProfile.update({
            where: { driverProfileId },
            data: { approvalState: 'REJECTED' },
        })
    }

    // ─── Users ────────────────────────────────────────────────────────────────

    async listUsers({ role, page = 1 } = {}) {
        const where = role ? { role } : {}
        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                select: {
                    userId: true, name: true, email: true,
                    phone: true, role: true,
                    emailVerifiedAt: true, deletedAt: true, createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
            }),
            prisma.user.count({ where }),
        ])
        return { users, total, page, pages: Math.ceil(total / PAGE_SIZE) }
    }

    async suspendUser(userId, reason, adminUserId) {
        return await prisma.suspension.create({
            data: { userId, reason, suspendedBy: adminUserId },
        })
    }

    async liftSuspension(suspensionId, adminUserId) {
        return await prisma.suspension.update({
            where: { id: suspensionId },
            data: { liftedAt: new Date(), liftedBy: adminUserId },
        })
    }

    // ─── Rides ────────────────────────────────────────────────────────────────

    async listRides({ state, page = 1 } = {}) {
        const where = state ? { state } : {}
        const [rides, total] = await prisma.$transaction([
            prisma.ride.findMany({
                where,
                include: {
                    rider: { include: { user: { select: { name: true, email: true } } } },
                    driver: { include: { user: { select: { name: true } } } },
                    payment: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * PAGE_SIZE,
                take: PAGE_SIZE,
            }),
            prisma.ride.count({ where }),
        ])
        return { rides, total, page, pages: Math.ceil(total / PAGE_SIZE) }
    }
}

module.exports = AdminRepository
