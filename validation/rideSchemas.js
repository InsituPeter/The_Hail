const { z } = require('zod')

const requestRideSchema = z.object({
    pickupAddress: z.string().min(1),
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    dropoffAddress: z.string().min(1),
    dropoffLat: z.number().min(-90).max(90),
    dropoffLng: z.number().min(-180).max(180),
    vehicleType: z.enum(['ECONOMY', 'COMFORT', 'XL']),
    paymentMethod: z.enum(['CASH', 'CARD']),
})

const estimateFareSchema = z.object({
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    dropoffLat: z.number().min(-90).max(90),
    dropoffLng: z.number().min(-180).max(180),
    vehicleType: z.enum(['ECONOMY', 'COMFORT', 'XL']),
})

const completeRideSchema = z.object({
    finalFare: z.number().positive(),
    paymentMethod: z.enum(['CASH', 'CARD']),
})

const cancelRideSchema = z.object({
    reason: z.string().min(1).optional(),
})

module.exports = { requestRideSchema, estimateFareSchema, completeRideSchema, cancelRideSchema }
