const AppError = require('./AppError')

class ValidationError extends AppError{
    constructor(message="Validation failed"){
        super(message, 422)
    }
}


module.exports = ValidationError