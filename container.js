const nodemailer = require('nodemailer')
const config = require('./config')
const mapsClient = require('./config/maps')
const paystackClient = require('./config/paystack')

// ─── Repositories ─────────────────────────────────────────────────────────────
const UserRepository = require('./Repository/UserRepository')
const TokenRepository = require('./Repository/tokenRepository')
const DriverRepository = require('./Repository/driverRepository')
const RiderRepository = require('./Repository/riderRepository')
const RideRepository = require('./Repository/rideRepository')
const PaymentRepository = require('./Repository/paymentRepository')
const AdminRepository = require('./Repository/adminRepository')

// ─── Domain ───────────────────────────────────────────────────────────────────
const TemplateDomain = require('./Domain/emailtemplate')

// ─── Services ─────────────────────────────────────────────────────────────────
const EmailService = require('./Services/emailService')
const AuthService = require('./Services/AuthService')
const UserService = require('./Services/userServices')
const DriverService = require('./Services/driverService')
const RiderService = require('./Services/riderService')
const RideService = require('./Services/rideService')
const MapsService = require('./Services/mapsService')
const PaymentService = require('./Services/paymentService')
const AdminService = require('./Services/adminService')

// ─── Controllers ──────────────────────────────────────────────────────────────
const AuthController = require('./controller/authController')
const UserController = require('./controller/userController')
const DriverController = require('./controller/driverController')
const RiderController = require('./controller/riderController')
const RideController = require('./controller/rideController')
const WebhookController = require('./controller/webhookController')
const AdminController = require('./controller/adminController')

// ─── Wiring ───────────────────────────────────────────────────────────────────

const userRepository = new UserRepository()
const tokenRepository = new TokenRepository()
const driverRepository = new DriverRepository()
const riderRepository = new RiderRepository()
const rideRepository = new RideRepository()
const paymentRepository = new PaymentRepository()
const adminRepository = new AdminRepository()

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    }
})

const templateDomain = new TemplateDomain(config.frontend.url, config.company.name, config.company.supportEmail)
const emailService = new EmailService(transporter, templateDomain, config)

const authService = new AuthService(userRepository, tokenRepository, emailService)
const userService = new UserService(userRepository, emailService, riderRepository)
const mapsService = new MapsService(mapsClient, config)
const paymentService = new PaymentService(paystackClient, config)
const driverService = new DriverService(driverRepository, rideRepository, paymentService)
const riderService = new RiderService(riderRepository, paymentService, config)
const rideService = new RideService(rideRepository, riderRepository, driverRepository, paymentRepository, mapsService, paymentService)

const adminService = new AdminService(adminRepository, driverRepository)

const authController = new AuthController(authService, userService)
const userController = new UserController(userService)
const driverController = new DriverController(driverService)
const riderController = new RiderController(riderService)
const rideController = new RideController(rideService)
const webhookController = new WebhookController(paymentService, paymentRepository)
const adminController = new AdminController(adminService)

module.exports = { authController, userController, driverController, riderController, rideController, webhookController, adminController, authService, tokenRepository }
