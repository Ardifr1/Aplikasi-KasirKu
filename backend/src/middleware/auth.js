const UserModel = require('../models/UserModel');
const { verifyToken } = require('../utils/jwt');

async function auth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const [scheme, token] = header.split(' ');

        if (!token || scheme !== 'Bearer') {
            return res.status(401).json({
                success: false,
                message: 'Token tidak ditemukan',
            });
        }

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Token tidak valid atau kedaluwarsa',
            });
        }

        // Never trust role from the client token alone: reload user + role
        // from the database on every authenticated request.
        const user = await UserModel.findById(decoded.sub);
        if (!user || user.status !== 'active') {
            return res.status(401).json({
                success: false,
                message: 'Pengguna tidak ditemukan atau nonaktif',
            });
        }

        req.user = user;
        return next();
    } catch (err) {
        return next(err);
    }
}

module.exports = auth;
