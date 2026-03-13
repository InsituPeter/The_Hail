const { z } = require('zod')

const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required').trim(),
    phone: z.string().min(1, 'Phone is required').trim(),
    role: z.enum(['RIDER', 'DRIVER'], { message: 'Role must be RIDER or DRIVER' }),
})

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
})

const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address'),
})

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema }
