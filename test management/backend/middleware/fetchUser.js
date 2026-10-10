const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./jwtSecret');

function fetchUser(req, res, next) {
    const token = req.header('auth-token');
    if (!token) {
        return res.status(401).json({ success: false, message: 'Please authenticate with a valid token' });
    }

    try {
        const data = jwt.verify(token, JWT_SECRET);
        req.user = data.user;
        return next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Please authenticate with a valid token' });
    }
}

module.exports = fetchUser;