const { z } = require('zod')

const suspendUserSchema = z.object({
    reason: z.string().min(1, 'Suspension reason is required'),
})

module.exports = { suspendUserSchema }
