const NotificationModel = require('../models/NotificationModel');

function parseId(param) {
    const id = parseInt(param, 10);
    return Number.isNaN(id) || id <= 0 ? null : id;
}

async function list(req, res, next) {
    try {
        // Never trust req.query.user_id — always use the authenticated user.
        const { unread_only } = req.query || {};
        const data = await NotificationModel.listForUser(req.user.id, { unread_only });
        return res.json({
            success: true,
            message: 'Notifications retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function unreadCount(req, res, next) {
    try {
        const count = await NotificationModel.unreadCount(req.user.id);
        return res.json({
            success: true,
            message: 'Unread count retrieved successfully',
            data: { count },
        });
    } catch (err) {
        return next(err);
    }
}

async function markRead(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }
        // Scoped to req.user.id: another user's notification yields 404.
        const updated = await NotificationModel.markRead(id, req.user.id);
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Notifikasi tidak ditemukan',
            });
        }
        return res.json({
            success: true,
            message: 'Notifikasi ditandai sudah dibaca',
            data: updated,
        });
    } catch (err) {
        return next(err);
    }
}

async function markAllRead(req, res, next) {
    try {
        const updated = await NotificationModel.markAllRead(req.user.id);
        return res.json({
            success: true,
            message: 'Semua notifikasi ditandai sudah dibaca',
            data: { updated },
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    list,
    unreadCount,
    markRead,
    markAllRead,
};
