const pool = require('../config/database');

const VALID_TYPES = ['info', 'warning', 'success', 'error'];

function formatRow(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        title: row.title,
        message: row.message,
        type: row.type,
        is_read: Number(row.is_read) === 1,
        created_at: row.created_at,
    };
}

async function create({ user_id, title, message, type = 'info' }) {
    const safeType = VALID_TYPES.includes(type) ? type : 'info';
    const [result] = await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [user_id, String(title).slice(0, 150), message, safeType]
    );
    return findByIdForUser(result.insertId, user_id);
}

async function findByIdForUser(id, userId) {
    const [rows] = await pool.query(
        `SELECT id, title, message, type, is_read, created_at
         FROM notifications
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [id, userId]
    );
    return formatRow(rows[0]);
}

async function listForUser(userId, { unread_only = false } = {}) {
    const conditions = ['user_id = ?'];
    const params = [userId];
    if (unread_only === true || String(unread_only).toLowerCase() === 'true') {
        conditions.push('is_read = 0');
    }
    const [rows] = await pool.query(
        `SELECT id, title, message, type, is_read, created_at
         FROM notifications
         WHERE ${conditions.join(' AND ')}
         ORDER BY id DESC
         LIMIT 200`,
        params
    );
    return rows.map(formatRow);
}

async function unreadCount(userId) {
    const [rows] = await pool.query(
        'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
    );
    return Number(rows[0].total);
}

async function markRead(id, userId) {
    const [result] = await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [id, userId]
    );
    if (result.affectedRows === 0) {
        return null;
    }
    return findByIdForUser(id, userId);
}

async function markAllRead(userId) {
    const [result] = await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId]
    );
    return result.affectedRows;
}

// Dedup helper: is there already an UNREAD notification with identical
// title+message for this user? Prevents spam for the same product/state.
async function hasIdenticalUnread(userId, title, message) {
    const [rows] = await pool.query(
        `SELECT id FROM notifications
         WHERE user_id = ? AND title = ? AND message = ? AND is_read = 0
         LIMIT 1`,
        [userId, title, message]
    );
    return rows.length > 0;
}

async function activeAdminIds() {
    const [rows] = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'admin' AND u.status = 'active'`
    );
    return rows.map((r) => r.id);
}

module.exports = {
    VALID_TYPES,
    create,
    findByIdForUser,
    listForUser,
    unreadCount,
    markRead,
    markAllRead,
    hasIdenticalUnread,
    activeAdminIds,
};
