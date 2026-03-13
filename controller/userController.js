class UserController {
    constructor(userService) {
        this.userService = userService
    }

    getUserById = async (req, res) => {
        const { userId } = req.params
        const user = await this.userService.getUserById(parseInt(userId))
        res.status(200).json({ user })
    }

    updateUser = async (req, res) => {
        const { userId } = req.params
        const updatedUser = await this.userService.updateUser(parseInt(userId), req.body)
        res.status(200).json({ user: updatedUser })
    }

    deleteUser = async (req, res) => {
        const { userId } = req.params
        await this.userService.deleteUser(parseInt(userId))
        res.status(200).json({ message: 'Account deleted successfully' })
    }
}

module.exports = UserController
