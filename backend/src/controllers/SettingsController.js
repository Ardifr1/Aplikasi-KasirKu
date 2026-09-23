const SettingsModel = require('../models/SettingsModel');
const logActivity = require('../utils/activity');

const MAX_LENGTHS = {
    store_name: 150,
    address: 2000,
    business_number: 50,
    email: 150,
    logo: 255,
};

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateSettings(body) {
    const errors = {};
    const keys = Object.keys(body || {});
    const unknown = keys.filter((k) => !SettingsModel.ALLOWED_FIELDS.includes(k));
    if (unknown.length > 0) {
        errors._unknown = `Field tidak diizinkan: ${unknown.join(', ')}`;
    }

    for (const key of SettingsModel.ALLOWED_FIELDS) {
        const value = body[key];
        if (value === undefined) {
            continue;
        }
        if (value !== null && typeof value !== 'string') {
            errors[key] = `${key} harus berupa teks`;
            continue;
        }
        if (value !== null && value.length > MAX_LENGTHS[key]) {
            errors[key] = `${key} maksimal ${MAX_LENGTHS[key]} karakter`;
        }
        if (key === 'email' && value !== null && String(value).trim() !== '' && !isValidEmail(String(value).trim())) {
            errors[key] = 'Email tidak valid';
        }
    }

    if (
        body.store_name !== undefined &&
        body.store_name !== null &&
        String(body.store_name).trim() === ''
    ) {
        errors.store_name = 'Nama toko wajib diisi';
    }

    return errors;
}

async function get(req, res, next) {
    try {
        const settings = await SettingsModel.get();
        return res.json({
            success: true,
            message: 'Settings retrieved successfully',
            data: settings,
        });
    } catch (err) {
        return next(err);
    }
}

async function update(req, res, next) {
    try {
        const body = req.body || {};
        if (Object.keys(body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { _empty: 'Tidak ada field untuk diperbarui' },
            });
        }
        const errors = validateSettings(body);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const cleaned = {};
        for (const key of SettingsModel.ALLOWED_FIELDS) {
            if (body[key] !== undefined) {
                cleaned[key] =
                    body[key] === null
                        ? null
                        : key === 'email'
                          ? String(body[key]).trim() === ''
                              ? null
                              : String(body[key]).trim()
                          : String(body[key]);
            }
        }

        const updated = await SettingsModel.upsert(cleaned, req.user.id);
        logActivity({
            req,
            action: 'settings.update',
            module: 'settings',
            description: 'Memperbarui pengaturan toko',
        });
        return res.json({
            success: true,
            message: 'Pengaturan berhasil diperbarui',
            data: updated,
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    get,
    update,
};
