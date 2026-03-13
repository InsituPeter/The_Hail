const notFound = (req, res, next)=>{
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This route does not exist' } })
}


module.exports = notFound