const AppError = require("./AppError")


class NotFoundError extends AppError{
    constructor(resource, id= null){
        const message = id
                        ?`${resource} with ID ${id} not Found`
                        :`${resource} not Found`
      
    super(message, 404);
    this.name ="NotFoundError";
    this.resource = resource;
    this.resourceId = id
    }
}


module.exports = NotFoundError