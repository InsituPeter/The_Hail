const { z } = require('zod')

const createDriverProfileSchema = z.object({
    licenseNumber: z.string().min(1, 'License number is required'),
    vehicleType: z.enum(['ECONOMY', 'COMFORT', 'XL']),
    vehicleMake: z.string().min(1, 'Vehicle make is required'),
    vehicleModel: z.string().min(1, 'Vehicle model is required'),
    vehiclePlate: z.string().min(1, 'Vehicle plate is required'),
    vehicleYear: z.number().int().min(2000).max(new Date().getFullYear() + 1),
})

const updateDriverProfileSchema = createDriverProfileSchema.partial().refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field is required' }
)

const availabilitySchema = z.object({
    isAvailable: z.boolean(),
})

const locationSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    heading: z.number().min(0).max(360).optional(),
})

const payoutAccountSchema = z.object({
    businessName: z.string().min(1, 'Business name is required'),
    settlementBank: z.string().min(1, 'Bank code is required'),
    accountNumber: z.string().regex(/^\d{10}$/, 'Account number must be exactly 10 digits'),
})

module.exports = { createDriverProfileSchema, updateDriverProfileSchema, availabilitySchema, locationSchema, payoutAccountSchema }
