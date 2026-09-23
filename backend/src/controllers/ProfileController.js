const UserModel = require('../models/UserModel');
const { comparePassword } = require('../utils/password');
const logActivity = require('../utils/activity');

const ALLOWED_PROFILE_FIELDS = ['name', 'username'];

function validateProfileUpdate(body) {
    const errors = {};

    if (body.name === undefined || body.name === null || String(body.name).trim() === '') {
        errors.name = 'Nama wajib diisi';
    } else if (typeof body.name !== 'string') {
        errors.name = 'Nama harus berupa teks';
    } else if (body.name.trim().length > 100) {
        errors.name = 'Nama maksimal 100 karakter';
    }

    if (body.username === undefined || body.username === null || String(body.username).trim() === '') {
        errors.username = 'Username wajib diisi';
    } else if (typeof body.username !== 'string') {
        errors.username = 'Username harus berupa teks';
    } else if (body.username.trim().length > 50) {
        errors.username = 'Username maksimal 50 karakter';
    }

    return errors;
}

function validatePasswordChange(body) {
    const errors = {};

    if (
        body.current_password === undefined ||
        body.current_password === null ||
        String(body.current_password) === ''
    ) {
        errors.current_password = 'Password saat ini wajib diisi';
    } else if (typeof body.current_password !== 'string') {
        errors.current_password = 'Password saat ini harus berupa teks';
    }

    if (
        body.new_password === undefined ||
        body.new_password === null ||
        String(body.new_password) === ''
    ) {
        errors.new_password = 'Password baru wajib diisi';
    } else if (typeof body.new_password !== 'string') {
        errors.new_password = 'Password baru harus berupa teks';
    } else if (body.new_password.length < 8) {
        errors.new_password = 'Password baru minimal 8 karakter';
    }

    return errors;
}

async function getProfile(req, res, next) {
    try {
        const profile = await UserModel.findDetailedById(req.user.id);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }
        return res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: profile,
        });
    } catch (err) {
        return next(err);
    }
}

async function updateProfile(req, res, next) {
    try {
        // Silently ignore disallowed fields (id, role_id, status, password).
        const extraKeys = Object.keys(req.body || {}).filter(
            (k) => !ALLOWED_PROFILE_FIELDS.includes(k)
        );
        if (extraKeys.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { _unknown: `Field tidak diizinkan: ${extraKeys.join(', ')}` },
            });
        }

        const errors = validateProfileUpdate(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const name = req.body.name.trim();
        const username = req.body.username.trim();

        const taken = await UserModel.usernameTaken(username, req.user.id);
        if (taken) {
            return res.status(409).json({
                success: false,
                message: 'Username sudah digunakan',
            });
        }

        const updated = await UserModel.updateProfile(req.user.id, { name, username });
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }

        return res.json({
            success: true,
            message: 'Profil berhasil diperbarui',
            data: updated,
        });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Username sudah digunakan',
            });
        }
        return next(err);
    }
}

async function changePassword(req, res, next) {
    try {
        const errors = validatePasswordChange(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const row = await UserModel.findByIdWithHash(req.user.id);
        if (!row) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }

        const ok = await comparePassword(req.body.current_password, row.password);
        if (!ok) {
            return res.status(401).json({
                success: false,
                message: 'Password saat ini salah',
            });
        }

        await UserModel.updatePassword(req.user.id, req.body.new_password);

        logActivity({
            req,
            action: 'profile.password_change',
            module: 'profile',
            description: 'Mengubah password sendiri',
        });

        return res.json({
            success: true,
            message: 'Password berhasil diubah',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
};
