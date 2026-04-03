class UserController {
    constructor(userService) {
        this.userService = userService
        this.getUserById = this.getUserById.bind(this)
        this.updateUser = this.updateUser.bind(this)
        this.deleteUser = this.deleteUser.bind(this)
    }

    async getUserById(req, res, next) {
        try {
            const user = await this.userService.getUserById(parseInt(req.params.userId))
            res.status(200).json({ data: { user } })
        } catch (err) {
            next(err)
        }
    }

    async updateUser(req, res, next) {
        try {
            const user = await this.userService.updateUser(parseInt(req.params.userId), req.body)
            res.status(200).json({ data: { user } })
        } catch (err) {
            next(err)
        }
    }

    async deleteUser(req, res, next) {
        try {
            await this.userService.deleteUser(parseInt(req.params.userId))
            res.status(204).send()
        } catch (err) {
            next(err)
        }
    }
}

module.exports = UserController
