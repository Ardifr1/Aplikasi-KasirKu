const ActivityLogModel = require('../models/ActivityLogModel');

function isDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return false;
    }
    return !Number.isNaN(new Date(value.trim()).getTime());
}

async function list(req, res, next) {
    try {
        const { user_id, action, module, date_from, date_to, search } = req.query || {};
        const errors = {};
        if (user_id !== undefined && user_id !== '' && !/^\d+$/.test(String(user_id).trim())) {
            errors.user_id = 'ID pengguna tidak valid';
        }
        if (date_from !== undefined && date_from !== '' && !isDateOnly(date_from)) {
            errors.date_from = 'Format tanggal tidak valid (YYYY-MM-DD)';
        }
        if (date_to !== undefined && date_to !== '' && !isDateOnly(date_to)) {
            errors.date_to = 'Format tanggal tidak valid (YYYY-MM-DD)';
        }
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const logs = await ActivityLogModel.list({
            user_id,
            action,
            module,
            date_from,
            date_to,
            search,
        });
        return res.json({
            success: true,
            message: 'Activity logs retrieved successfully',
            data: logs,
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    list,
};
