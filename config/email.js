const nodemailer = require('nodemailer')
const config = require('./index')

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    }
})

module.exports = transporter