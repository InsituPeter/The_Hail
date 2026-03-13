const { AppError } = require('../errors')

class MapsService {
    constructor(mapsClient, config) {
        this.mapsClient = mapsClient
        this.config = config
    }

    async getDistanceAndDuration(originLat, originLng, destLat, destLng) {
        const response = await this.mapsClient.distancematrix({
            params: {
                origins: [{ lat: originLat, lng: originLng }],
                destinations: [{ lat: destLat, lng: destLng }],
                key: this.config.googleMaps.apiKey,
            },
        })

        const element = response.data.rows[0]?.elements[0]
        if (!element || element.status !== 'OK') {
            throw new AppError('Google Maps returned no route', 502)
        }

        const distanceKm = element.distance.value / 1000
        const durationMin = Math.ceil(element.duration.value / 60)

        return { distanceKm, durationMin }
    }
}

module.exports = MapsService
