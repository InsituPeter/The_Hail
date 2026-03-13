const crypto = require('crypto')
const { AppError } = require('../errors')

class PaymentService {
    constructor(paystackClient, config) {
        this.paystack = paystackClient
        this.config = config
    }

    // ─── Card setup ───────────────────────────────────────────────────────────

    async initializeTransaction(email, amountNaira, callbackUrl) {
        const amountInKobo = Math.round(amountNaira * 100)
        const { data } = await this.paystack.post('/transaction/initialize', {
            email,
            amount: amountInKobo,
            callback_url: callbackUrl,
            channels: ['card'],
        })
        return { authorizationUrl: data.data.authorization_url, reference: data.data.reference }
    }

    async verifyTransaction(reference) {
        const { data } = await this.paystack.get(`/transaction/verify/${reference}`)
        if (data.data.status !== 'success') {
            throw new AppError('Card setup payment was not successful', 400)
        }
        const auth = data.data.authorization
        return {
            authorizationCode: auth.authorization_code,
            email: data.data.customer.email,
        }
    }

    // ─── Ride payment ─────────────────────────────────────────────────────────

    async chargeAuthorization(authorizationCode, email, amountNaira, subaccountCode) {
        const amountInKobo = Math.round(amountNaira * 100)
        const platformFee = Math.round(amountInKobo * (this.config.platformFeePercent / 100))

        const { data } = await this.paystack.post('/transaction/charge_authorization', {
            authorization_code: authorizationCode,
            email,
            amount: amountInKobo,
            subaccount: subaccountCode,
            transaction_charge: platformFee,
            bearer: 'subaccount',   // driver bears transaction fees, platform keeps its cut clean
        })

        if (data.data.status !== 'success') {
            throw new AppError('Card charge failed', 402)
        }

        return { reference: data.data.reference }
    }

    // ─── Driver onboarding ────────────────────────────────────────────────────

    async createSubaccount({ businessName, settlementBank, accountNumber, percentageCharge }) {
        const { data } = await this.paystack.post('/subaccount', {
            business_name: businessName,
            settlement_bank: settlementBank,
            account_number: accountNumber,
            percentage_charge: percentageCharge,
        })
        return { subaccountCode: data.data.subaccount_code }
    }

    // ─── Webhook verification ─────────────────────────────────────────────────

    constructWebhookEvent(rawBody, signature) {
        const hash = crypto
            .createHmac('sha512', this.config.paystack.secretKey)
            .update(rawBody)
            .digest('hex')

        if (hash !== signature) {
            throw new AppError('Webhook signature verification failed', 400)
        }

        return JSON.parse(rawBody)
    }
}

module.exports = PaymentService
