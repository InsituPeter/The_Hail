const dotenv = require('dotenv')
const path = require('path')

const envFile = process.env.NODE_ENV ? `.${process.env.NODE_ENV}.env` : '.env'
dotenv.config({ path: path.resolve(__dirname, '..', envFile) })

const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000,
    jwt: {
        secret: process.env.JWT_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    db: {
        url: process.env.DATABASE_URL,
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    frontend: {
        url: process.env.FRONTEND_URL || 'http://localhost:5173',
    },
    company: {
        name: process.env.COMPANY_NAME || 'The Hail',
        supportEmail: process.env.SUPPORT_EMAIL,
    },
    googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
    paystack: {
        secretKey: process.env.PAYSTACK_SECRET_KEY,
    },
    platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 10,
}

module.exports = config