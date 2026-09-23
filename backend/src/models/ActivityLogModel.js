const pool = require('../config/database');

function truncate(value, max) {
    if (value === null || value === undefined) {
        return null;
    }
    const s = String(value);
    return s.length > max ? s.slice(0, max) : s;
}

async function create({ user_id = null, action, module, description = null, ip_address = null }) {
    const [result] = await pool.query(
        `INSERT INTO activity_logs (user_id, action, module, description, ip_address)
         VALUES (?, ?, ?, ?, ?)`,
        [
            user_id,
            truncate(action, 100),
            truncate(module, 100),
            description === undefined ? null : description,
            ip_address ? truncate(ip_address, 45) : null,
        ]
    );
    return findById(result.insertId);
}

async function findById(id) {
    const [rows] = await pool.query(
        `SELECT l.id, l.user_id, l.action, l.module, l.description,
                l.ip_address, l.created_at,
                u.username, u.name AS user_name
         FROM activity_logs l
         LEFT JOIN users u ON u.id = l.user_id
         WHERE l.id = ?
         LIMIT 1`,
        [id]
    );
    return formatRow(rows[0]);
}

function formatRow(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        user: row.user_id
            ? { id: row.user_id, username: row.username, name: row.user_name }
            : null,
        action: row.action,
        module: row.module,
        description: row.description,
        ip_address: row.ip_address,
        created_at: row.created_at,
    };
}

async function list(filters = {}) {
    const conditions = [];
    const params = [];

    if (
        filters.user_id !== undefined &&
        filters.user_id !== null &&
        String(filters.user_id).trim() !== ''
    ) {
        conditions.push('l.user_id = ?');
        params.push(parseInt(String(filters.user_id).trim(), 10));
    }

    if (filters.action !== undefined && filters.action !== null && String(filters.action).trim() !== '') {
        conditions.push('l.action = ?');
        params.push(String(filters.action).trim());
    }

    if (filters.module !== undefined && filters.module !== null && String(filters.module).trim() !== '') {
        conditions.push('l.module = ?');
        params.push(String(filters.module).trim());
    }

    if (filters.search !== undefined && filters.search !== null && String(filters.search).trim() !== '') {
        conditions.push('(l.action LIKE ? OR l.module LIKE ? OR l.description LIKE ?)');
        const like = `%${String(filters.search).trim()}%`;
        params.push(like, like, like);
    }

    if (
        filters.date_from !== undefined &&
        filters.date_from !== null &&
        String(filters.date_from).trim() !== ''
    ) {
        conditions.push('l.created_at >= ?');
        params.push(`${String(filters.date_from).trim()} 00:00:00`);
    }

    if (
        filters.date_to !== undefined &&
        filters.date_to !== null &&
        String(filters.date_to).trim() !== ''
    ) {
        // Exclusive upper bound: < (date_to + 1 day), index-friendly.
        conditions.push('l.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
        params.push(String(filters.date_to).trim());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT l.id, l.user_id, l.action, l.module, l.description,
                l.ip_address, l.created_at,
                u.username, u.name AS user_name
         FROM activity_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ${where}
         ORDER BY l.id DESC
         LIMIT 200`,
        params
    );
    return rows.map(formatRow);
}

module.exports = {
    create,
    findById,
    list,
};
