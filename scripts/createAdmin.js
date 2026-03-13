/**
 * One-off script to create an ADMIN user.
 * Run inside the container:
 *   docker exec hail_api node scripts/createAdmin.js
 *
 * The ADMIN role cannot be self-registered via the API by design.
 * This script is the only sanctioned way to create one.
 */

const bcrypt    = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const EMAIL    = process.env.ADMIN_EMAIL    || 'admin@thehail.com'
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'
const NAME     = process.env.ADMIN_NAME     || 'Super Admin'

async function main() {
    const existing = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (existing) {
        console.log(`User ${EMAIL} already exists (role: ${existing.role}). Nothing created.`)
        return
    }

    const hashedPassword = await bcrypt.hash(PASSWORD, 10)

    const admin = await prisma.user.create({
        data: {
            email:    EMAIL,
            password: hashedPassword,
            name:     NAME,
            role:     'ADMIN',
            emailVerifiedAt: new Date(),   // admins are pre-verified
        },
        select: { userId: true, email: true, role: true },
    })

    console.log('Admin user created:', admin)
    console.log(`Email:    ${EMAIL}`)
    console.log(`Password: ${PASSWORD}`)
    console.log('Change the password after first login.')
}

main()
    .catch(err => { console.error(err); process.exit(1) })
    .finally(() => prisma.$disconnect())
