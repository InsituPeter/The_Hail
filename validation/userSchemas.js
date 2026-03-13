const { z } = require('zod')

const updateUserSchema = z.object({
    name: z.string().min(1).trim().optional(),
    phone: z.string().min(1).trim().optional(),
    email: z.string().email().optional(),
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field is required'
})

module.exports = { updateUserSchema }
