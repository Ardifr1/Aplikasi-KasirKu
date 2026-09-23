const pool = require('../config/database');

async function findAll() {
    const [rows] = await pool.query(
        `SELECT id, name, description, created_at, updated_at
         FROM categories
         ORDER BY id ASC`
    );
    return rows;
}

async function findById(id) {
    const [rows] = await pool.query(
        `SELECT id, name, description, created_at, updated_at
         FROM categories
         WHERE id = ?
         LIMIT 1`,
        [id]
    );
    return rows[0] || null;
}

async function create({ name, description = null }) {
    const [result] = await pool.query(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [name, description]
    );
    return findById(result.insertId);
}

async function update(id, { name, description }) {
    const fields = [];
    const params = [];
    if (name !== undefined) {
        fields.push('name = ?');
        params.push(name);
    }
    if (description !== undefined) {
        fields.push('description = ?');
        params.push(description);
    }
    if (fields.length === 0) {
        return findById(id);
    }
    params.push(id);
    const [result] = await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) {
        return findById(id);
    }
    return findById(id);
}

async function remove(id) {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

async function nameExists(name, excludeId = null) {
    if (excludeId === null || excludeId === undefined) {
        const [rows] = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [name]);
        return rows.length > 0;
    }
    const [rows] = await pool.query(
        'SELECT id FROM categories WHERE name = ? AND id <> ? LIMIT 1',
        [name, excludeId]
    );
    return rows.length > 0;
}

async function productCount(categoryId) {
    const [rows] = await pool.query(
        'SELECT COUNT(*) AS total FROM products WHERE category_id = ?',
        [categoryId]
    );
    return rows[0].total;
}

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove,
    nameExists,
    productCount,
};
