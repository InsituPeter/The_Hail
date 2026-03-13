class AppError extends Error{
    constructor(message, statusCode=500, errorCode){
        super(message)
        this.statusCode=statusCode
        this.errorCode=errorCode
        this.timestamp = new Date().toISOString()
        this.isOperational= true
        this.name=this.constructor.name
        Error.captureStackTrace(this, this.constructor)
    
    }
}

module.exports =AppError