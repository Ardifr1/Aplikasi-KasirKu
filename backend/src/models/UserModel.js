const pool = require('../config/database');
const { hashPassword } = require('../utils/password');

function toPublicUser(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        name: row.name,
        username: row.username,
        role: row.role,
        status: row.status,
    };
}

function toDetailedUser(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        name: row.name,
        username: row.username,
        role: {
            id: row.role_id,
            name: row.role,
        },
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function findByUsername(username) {
    const [rows] = await pool.query(
        `SELECT u.id, u.name, u.username, u.password, u.role_id, u.status,
                r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.username = ?
         LIMIT 1`,
        [username]
    );
    return rows[0] || null;
}

async function findById(id) {
    const [rows] = await pool.query(
        `SELECT u.id, u.name, u.username, u.role_id, u.status,
                r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1`,
        [id]
    );
    return toPublicUser(rows[0]);
}

async function findDetailedById(id) {
    const [rows] = await pool.query(
        `SELECT u.id, u.name, u.username, u.role_id, u.status,
                u.created_at, u.updated_at,
                r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1`,
        [id]
    );
    return toDetailedUser(rows[0]);
}

async function findByIdWithHash(id) {
    const [rows] = await pool.query(
        `SELECT u.id, u.name, u.username, u.password, u.role_id, u.status,
                r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1`,
        [id]
    );
    return rows[0] || null;
}

function buildListConditions({ role, status, search }) {
    const conditions = [];
    const params = [];

    if (role !== undefined && role !== null && String(role).trim() !== '') {
        const value = String(role).trim();
        if (/^\d+$/.test(value)) {
            conditions.push('u.role_id = ?');
            params.push(parseInt(value, 10));
        } else {
            conditions.push('r.name = ?');
            params.push(value);
        }
    }

    if (status !== undefined && status !== null && String(status).trim() !== '') {
        conditions.push('u.status = ?');
        params.push(String(status).trim());
    }

    if (search !== undefined && search !== null && String(search).trim() !== '') {
        conditions.push('(u.name LIKE ? OR u.username LIKE ?)');
        const like = `%${String(search).trim()}%`;
        params.push(like, like);
    }

    return { conditions, params };
}

async function findAll(filters = {}) {
    const { conditions, params } = buildListConditions(filters);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT u.id, u.name, u.username, u.role_id, u.status,
                u.created_at, u.updated_at,
                r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         ${where}
         ORDER BY u.id ASC`,
        params
    );
    return rows.map(toDetailedUser);
}

async function count(filters = {}) {
    const { conditions, params } = buildListConditions(filters);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM users u
         JOIN roles r ON r.id = u.role_id
         ${where}`,
        params
    );
    return rows[0].total;
}

async function roleExists(roleId) {
    const [rows] = await pool.query('SELECT id FROM roles WHERE id = ? LIMIT 1', [roleId]);
    return rows.length > 0;
}

async function usernameTaken(username, excludeId = null) {
    if (excludeId === null || excludeId === undefined) {
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [
            username,
        ]);
        return rows.length > 0;
    }
    const [rows] = await pool.query(
        'SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1',
        [username, excludeId]
    );
    return rows.length > 0;
}

async function create({ name, username, password, roleId, status = 'active' }) {
    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
        'INSERT INTO users (name, username, password, role_id, status) VALUES (?, ?, ?, ?, ?)',
        [name, username, passwordHash, roleId, status]
    );
    return findById(result.insertId);
}

async function updatePassword(id, newPlainPassword) {
    const passwordHash = await hashPassword(newPlainPassword);
    const [result] = await pool.query('UPDATE users SET password = ? WHERE id = ?', [
        passwordHash,
        id,
    ]);
    return result.affectedRows > 0;
}

async function updateProfile(id, { name, username }) {
    const fields = [];
    const params = [];
    if (name !== undefined) {
        fields.push('name = ?');
        params.push(name);
    }
    if (username !== undefined) {
        fields.push('username = ?');
        params.push(username);
    }
    if (fields.length === 0) {
        return findDetailedById(id);
    }
    params.push(id);
    const [result] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) {
        return null;
    }
    return findDetailedById(id);
}

async function updateUser(id, { name, username, roleId, status }) {
    const fields = [];
    const params = [];
    if (name !== undefined) {
        fields.push('name = ?');
        params.push(name);
    }
    if (username !== undefined) {
        fields.push('username = ?');
        params.push(username);
    }
    if (roleId !== undefined) {
        fields.push('role_id = ?');
        params.push(roleId);
    }
    if (status !== undefined) {
        fields.push('status = ?');
        params.push(status);
    }
    if (fields.length === 0) {
        return findDetailedById(id);
    }
    params.push(id);
    const [result] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) {
        // Row may exist but values identical; verify existence.
        const existing = await findDetailedById(id);
        return existing;
    }
    return findDetailedById(id);
}

async function remove(id) {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

module.exports = {
    toPublicUser,
    toDetailedUser,
    findByUsername,
    findById,
    findDetailedById,
    findByIdWithHash,
    findAll,
    count,
    roleExists,
    usernameTaken,
    create,
    updatePassword,
    updateProfile,
    updateUser,
    remove,
};
