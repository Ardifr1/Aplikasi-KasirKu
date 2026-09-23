const pool = require('../config/database');

function toApiProduct(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        price: Number(row.price),
        stock: row.stock,
        image: row.image,
        category: row.category_id
            ? {
                  id: row.category_id,
                  name: row.category_name,
              }
            : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

const SELECT_PRODUCT = `SELECT p.id, p.category_id, p.name, p.barcode, p.price,
            p.stock, p.image, p.created_at, p.updated_at,
            c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id`;

async function findAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.category_id !== undefined && filters.category_id !== null && String(filters.category_id).trim() !== '') {
        conditions.push('p.category_id = ?');
        params.push(parseInt(String(filters.category_id).trim(), 10));
    }

    if (filters.barcode !== undefined && filters.barcode !== null && String(filters.barcode).trim() !== '') {
        conditions.push('p.barcode = ?');
        params.push(String(filters.barcode).trim());
    }

    if (filters.search !== undefined && filters.search !== null && String(filters.search).trim() !== '') {
        conditions.push('(p.name LIKE ? OR p.barcode LIKE ?)');
        const like = `%${String(filters.search).trim()}%`;
        params.push(like, like);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(`${SELECT_PRODUCT} ${where} ORDER BY p.id ASC`, params);
    return rows.map(toApiProduct);
}

async function findById(id) {
    const [rows] = await pool.query(`${SELECT_PRODUCT} WHERE p.id = ? LIMIT 1`, [id]);
    return toApiProduct(rows[0]);
}

async function findByBarcode(barcode) {
    const [rows] = await pool.query(`${SELECT_PRODUCT} WHERE p.barcode = ? LIMIT 1`, [barcode]);
    return toApiProduct(rows[0]);
}

async function create({ category_id, name, barcode = null, price, stock = 0, image = null }) {
    const [result] = await pool.query(
        'INSERT INTO products (category_id, name, barcode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)',
        [category_id, name, barcode, price, stock, image]
    );
    return findById(result.insertId);
}

async function update(id, { category_id, name, barcode, price, stock, image }) {
    const fields = [];
    const params = [];
    if (category_id !== undefined) {
        fields.push('category_id = ?');
        params.push(category_id);
    }
    if (name !== undefined) {
        fields.push('name = ?');
        params.push(name);
    }
    if (barcode !== undefined) {
        fields.push('barcode = ?');
        params.push(barcode);
    }
    if (price !== undefined) {
        fields.push('price = ?');
        params.push(price);
    }
    if (stock !== undefined) {
        fields.push('stock = ?');
        params.push(stock);
    }
    if (image !== undefined) {
        fields.push('image = ?');
        params.push(image);
    }
    if (fields.length === 0) {
        return findById(id);
    }
    params.push(id);
    const [result] = await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) {
        return findById(id);
    }
    return findById(id);
}

async function remove(id) {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

async function barcodeExists(barcode, excludeId = null) {
    if (barcode === null || barcode === undefined || String(barcode).trim() === '') {
        return false;
    }
    const value = String(barcode).trim();
    if (excludeId === null || excludeId === undefined) {
        const [rows] = await pool.query('SELECT id FROM products WHERE barcode = ? LIMIT 1', [value]);
        return rows.length > 0;
    }
    const [rows] = await pool.query(
        'SELECT id FROM products WHERE barcode = ? AND id <> ? LIMIT 1',
        [value, excludeId]
    );
    return rows.length > 0;
}

async function categoryExists(categoryId) {
    const [rows] = await pool.query('SELECT id FROM categories WHERE id = ? LIMIT 1', [categoryId]);
    return rows.length > 0;
}

module.exports = {
    findAll,
    findById,
    findByBarcode,
    create,
    update,
    remove,
    barcodeExists,
    categoryExists,
};
