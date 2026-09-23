const UserModel = require('../models/UserModel');
const logActivity = require('../utils/activity');

const VALID_STATUSES = ['active', 'inactive'];

function parseId(param) {
    const id = parseInt(param, 10);
    return Number.isNaN(id) || id <= 0 ? null : id;
}

function validateCreate(body) {
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

    if (body.password === undefined || body.password === null || String(body.password) === '') {
        errors.password = 'Password wajib diisi';
    } else if (typeof body.password !== 'string') {
        errors.password = 'Password harus berupa teks';
    } else if (body.password.length < 8) {
        errors.password = 'Password minimal 8 karakter';
    }

    if (body.role_id === undefined || body.role_id === null || String(body.role_id).trim() === '') {
        errors.role_id = 'Role wajib diisi';
    } else if (!/^\d+$/.test(String(body.role_id).trim())) {
        errors.role_id = 'Role tidak valid';
    }

    if (body.status !== undefined && body.status !== null && String(body.status).trim() !== '') {
        if (!VALID_STATUSES.includes(String(body.status).trim())) {
            errors.status = 'Status tidak valid';
        }
    }

    return errors;
}

function validateUpdate(body) {
    const errors = {};

    if (body.name !== undefined) {
        if (body.name === null || String(body.name).trim() === '') {
            errors.name = 'Nama wajib diisi';
        } else if (typeof body.name !== 'string') {
            errors.name = 'Nama harus berupa teks';
        } else if (body.name.trim().length > 100) {
            errors.name = 'Nama maksimal 100 karakter';
        }
    }

    if (body.username !== undefined) {
        if (body.username === null || String(body.username).trim() === '') {
            errors.username = 'Username wajib diisi';
        } else if (typeof body.username !== 'string') {
            errors.username = 'Username harus berupa teks';
        } else if (body.username.trim().length > 50) {
            errors.username = 'Username maksimal 50 karakter';
        }
    }

    if (body.role_id !== undefined) {
        if (body.role_id === null || String(body.role_id).trim() === '') {
            errors.role_id = 'Role wajib diisi';
        } else if (!/^\d+$/.test(String(body.role_id).trim())) {
            errors.role_id = 'Role tidak valid';
        }
    }

    if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(String(body.status).trim())) {
            errors.status = 'Status tidak valid';
        }
    }

    return errors;
}

async function list(req, res, next) {
    try {
        const { role, status, search } = req.query || {};
        if (status !== undefined && status !== '' && !VALID_STATUSES.includes(String(status))) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { status: 'Status tidak valid' },
            });
        }
        const users = await UserModel.findAll({ role, status, search });
        return res.json({
            success: true,
            message: 'Users retrieved successfully',
            data: users,
        });
    } catch (err) {
        return next(err);
    }
}

async function detail(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }
        const user = await UserModel.findDetailedById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }
        return res.json({
            success: true,
            message: 'User retrieved successfully',
            data: user,
        });
    } catch (err) {
        return next(err);
    }
}

async function create(req, res, next) {
    try {
        const errors = validateCreate(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const name = req.body.name.trim();
        const username = req.body.username.trim();
        const roleId = parseInt(String(req.body.role_id).trim(), 10);
        const status =
            req.body.status === undefined || req.body.status === null || String(req.body.status).trim() === ''
                ? 'active'
                : String(req.body.status).trim();

        const roleOk = await UserModel.roleExists(roleId);
        if (!roleOk) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { role_id: 'Role tidak ditemukan' },
            });
        }

        const taken = await UserModel.usernameTaken(username);
        if (taken) {
            return res.status(409).json({
                success: false,
                message: 'Username sudah digunakan',
            });
        }

        const created = await UserModel.create({
            name,
            username,
            password: req.body.password,
            roleId,
            status,
        });

        const detailed = await UserModel.findDetailedById(created.id);
        logActivity({
            req,
            action: 'user.create',
            module: 'users',
            description: `Membuat pengguna ${username}`,
        });
        return res.status(201).json({
            success: true,
            message: 'Pengguna berhasil dibuat',
            data: detailed || created,
        });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Username sudah digunakan',
            });
        }
        if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { role_id: 'Role tidak ditemukan' },
            });
        }
        return next(err);
    }
}

async function update(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }

        if (req.body && (req.body.password !== undefined || req.body.new_password !== undefined)) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { password: 'Gunakan endpoint password khusus untuk mengubah password' },
            });
        }

        const errors = validateUpdate(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const existing = await UserModel.findDetailedById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }

        const patch = {};
        if (req.body.name !== undefined) {
            patch.name = req.body.name.trim();
        }
        if (req.body.username !== undefined) {
            patch.username = req.body.username.trim();
            const taken = await UserModel.usernameTaken(patch.username, id);
            if (taken) {
                return res.status(409).json({
                    success: false,
                    message: 'Username sudah digunakan',
                });
            }
        }
        if (req.body.role_id !== undefined) {
            const roleId = parseInt(String(req.body.role_id).trim(), 10);
            const roleOk = await UserModel.roleExists(roleId);
            if (!roleOk) {
                return res.status(400).json({
                    success: false,
                    message: 'Validasi gagal',
                    errors: { role_id: 'Role tidak ditemukan' },
                });
            }
            patch.roleId = roleId;
        }
        if (req.body.status !== undefined) {
            patch.status = String(req.body.status).trim();
        }

        const updated = await UserModel.updateUser(id, patch);
        logActivity({
            req,
            action: 'user.update',
            module: 'users',
            description: `Memperbarui pengguna id ${id}`,
        });
        return res.json({
            success: true,
            message: 'Pengguna berhasil diperbarui',
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

async function resetPassword(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }

        const newPassword = req.body ? req.body.new_password : undefined;
        if (newPassword === undefined || newPassword === null || String(newPassword) === '') {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { new_password: 'Password baru wajib diisi' },
            });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { new_password: 'Password baru minimal 8 karakter' },
            });
        }

        const existing = await UserModel.findDetailedById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }

        await UserModel.updatePassword(id, newPassword);
        logActivity({
            req,
            action: 'user.password_reset',
            module: 'users',
            description: `Mereset password pengguna id ${id}`,
        });
        return res.json({
            success: true,
            message: 'Password pengguna berhasil direset',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
}

async function remove(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }

        if (req.user && req.user.id === id) {
            return res.status(400).json({
                success: false,
                message: 'Tidak dapat menghapus akun sendiri',
            });
        }

        const existing = await UserModel.findDetailedById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Pengguna tidak ditemukan',
            });
        }

        try {
            const deleted = await UserModel.remove(id);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Pengguna tidak ditemukan',
                });
            }
        } catch (err) {
            if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.status(409).json({
                    success: false,
                    message: 'Pengguna tidak dapat dihapus karena memiliki riwayat transaksi/aktivitas',
                });
            }
            throw err;
        }

        logActivity({
            req,
            action: 'user.delete',
            module: 'users',
            description: `Menghapus pengguna ${existing.username}`,
        });

        return res.json({
            success: true,
            message: 'Pengguna berhasil dihapus',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    list,
    detail,
    create,
    update,
    resetPassword,
    remove,
};
