const { z } = require('zod')

const setupPaymentMethodSchema = z.object({
    email: z.string().email('A valid email address is required'),
})

module.exports = { setupPaymentMethodSchema }
