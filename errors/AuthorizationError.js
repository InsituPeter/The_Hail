const AppError = require("./AppError")

class AuthorizationError extends AppError{
    constructor(message="Authentication required"){
        super(message, 401)
    
    }
}

module.exports = AuthorizationError