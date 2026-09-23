const UserModel = require('../models/UserModel');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const logActivity = require('../utils/activity');

function validateLogin(body) {
    const errors = {};

    if (body.username === undefined || body.username === null || String(body.username).trim() === '') {
        errors.username = 'Username wajib diisi';
    } else if (typeof body.username !== 'string') {
        errors.username = 'Username harus berupa teks';
    } else if (body.username.length > 50) {
        errors.username = 'Username maksimal 50 karakter';
    }

    if (body.password === undefined || body.password === null || String(body.password) === '') {
        errors.password = 'Password wajib diisi';
    } else if (typeof body.password !== 'string') {
        errors.password = 'Password harus berupa teks';
    }

    return errors;
}

async function login(req, res, next) {
    try {
        const errors = validateLogin(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const username = req.body.username.trim();
        const row = await UserModel.findByUsername(username);

        // Generic message: do not reveal whether username or password was wrong.
        if (!row || row.status !== 'active') {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah',
            });
        }

        const ok = await comparePassword(req.body.password, row.password);
        if (!ok) {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah',
            });
        }

        const user = UserModel.toPublicUser(row);
        const token = signToken(user);

        logActivity({
            req,
            action: 'login',
            module: 'auth',
            description: `Login berhasil: ${user.username}`,
        });

        return res.json({
            success: true,
            message: 'Login berhasil',
            data: { user, token },
        });
    } catch (err) {
        return next(err);
    }
}

async function me(req, res) {
    return res.json({
        success: true,
        message: 'Profil pengguna',
        data: { user: req.user },
    });
}

// JWT is stateless: the server cannot invalidate an already-issued token
// without a blacklist/store. Logout therefore only acknowledges the request
// and instructs the client to discard the token.
async function logout(req, res) {
    return res.json({
        success: true,
        message: 'Logout berhasil. Hapus token di sisi klien.',
        data: null,
    });
}

module.exports = {
    login,
    me,
    logout,
};
