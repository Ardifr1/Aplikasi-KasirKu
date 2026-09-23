const pool = require('../config/database');

const MOVEMENT_TYPES = ['in', 'out', 'adjustment'];
const ADJUSTMENT_TYPES = ['in', 'out'];

function toStockItem(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        stock: row.stock,
        price: Number(row.price),
        category: row.category_id
            ? {
                  id: row.category_id,
                  name: row.category_name,
              }
            : null,
    };
}

function toMovement(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        product: {
            id: row.product_id,
            name: row.product_name,
            barcode: row.barcode,
        },
        type: row.type,
        quantity: row.quantity,
        stock_before: row.stock_before,
        stock_after: row.stock_after,
        description: row.description,
        created_by: row.created_by
            ? {
                  id: row.created_by,
                  username: row.created_by_username,
                  name: row.created_by_name,
              }
            : null,
        created_at: row.created_at,
    };
}

function isTrueLike(value) {
    if (value === true) {
        return true;
    }
    const s = String(value).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
}

async function getStockList(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.search !== undefined && filters.search !== null && String(filters.search).trim() !== '') {
        conditions.push('(p.name LIKE ? OR p.barcode LIKE ?)');
        const like = `%${String(filters.search).trim()}%`;
        params.push(like, like);
    }

    if (
        filters.category_id !== undefined &&
        filters.category_id !== null &&
        String(filters.category_id).trim() !== ''
    ) {
        conditions.push('p.category_id = ?');
        params.push(parseInt(String(filters.category_id).trim(), 10));
    }

    if (filters.out_of_stock !== undefined && isTrueLike(filters.out_of_stock)) {
        conditions.push('p.stock <= 0');
    } else if (filters.low_stock !== undefined && String(filters.low_stock).trim() !== '') {
        const raw = String(filters.low_stock).trim().toLowerCase();
        let threshold = 5;
        if (/^\d+$/.test(raw)) {
            threshold = parseInt(raw, 10);
        } else if (!isTrueLike(raw)) {
            // Unknown low_stock value: ignore filter rather than erroring here.
            threshold = null;
        }
        if (threshold !== null) {
            conditions.push('p.stock > 0 AND p.stock <= ?');
            params.push(threshold);
        }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT p.id, p.category_id, p.name, p.barcode, p.price, p.stock,
                c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         ${where}
         ORDER BY p.id ASC`,
        params
    );
    return rows.map(toStockItem);
}

async function getProductStock(productId) {
    const [rows] = await pool.query(
        `SELECT p.id, p.category_id, p.name, p.barcode, p.price, p.stock,
                p.image, p.created_at, p.updated_at,
                c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?
         LIMIT 1`,
        [productId]
    );
    if (!rows[0]) {
        return null;
    }
    const row = rows[0];
    return {
        id: row.id,
        name: row.name,
        barcode: row.barcode,
        price: Number(row.price),
        stock: row.stock,
        image: row.image,
        category: row.category_id
            ? { id: row.category_id, name: row.category_name }
            : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function getMovements(filters = {}) {
    const conditions = [];
    const params = [];

    if (
        filters.product_id !== undefined &&
        filters.product_id !== null &&
        String(filters.product_id).trim() !== ''
    ) {
        conditions.push('sm.product_id = ?');
        params.push(parseInt(String(filters.product_id).trim(), 10));
    }

    if (filters.type !== undefined && filters.type !== null && String(filters.type).trim() !== '') {
        conditions.push('sm.type = ?');
        params.push(String(filters.type).trim());
    }

    if (
        filters.created_by !== undefined &&
        filters.created_by !== null &&
        String(filters.created_by).trim() !== ''
    ) {
        conditions.push('sm.created_by = ?');
        params.push(parseInt(String(filters.created_by).trim(), 10));
    }

    if (filters.date_from !== undefined && filters.date_from !== null && String(filters.date_from).trim() !== '') {
        conditions.push('sm.created_at >= ?');
        params.push(String(filters.date_from).trim());
    }

    if (filters.date_to !== undefined && filters.date_to !== null && String(filters.date_to).trim() !== '') {
        conditions.push('sm.created_at <= ?');
        params.push(String(filters.date_to).trim());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
        `SELECT sm.id, sm.product_id, sm.type, sm.quantity,
                sm.stock_before, sm.stock_after, sm.description,
                sm.created_by, sm.created_at,
                p.name AS product_name, p.barcode,
                u.username AS created_by_username, u.name AS created_by_name
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
         LEFT JOIN users u ON u.id = sm.created_by
         ${where}
         ORDER BY sm.id DESC`,
        params
    );
    return rows.map(toMovement);
}

async function fetchMovementById(id, connection = null) {
    const runner = connection || pool;
    const [rows] = await runner.query(
        `SELECT sm.id, sm.product_id, sm.type, sm.quantity,
                sm.stock_before, sm.stock_after, sm.description,
                sm.created_by, sm.created_at,
                p.name AS product_name, p.barcode,
                u.username AS created_by_username, u.name AS created_by_name
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
         LEFT JOIN users u ON u.id = sm.created_by
         WHERE sm.id = ?
         LIMIT 1`,
        [id]
    );
    return toMovement(rows[0]);
}

// Low-level insert. Prefer createAdjustment() which wraps this in a
// transaction with SELECT ... FOR UPDATE row locking.
async function createMovement(
    { product_id, type, quantity, stock_before, stock_after, description = null, created_by = null },
    connection = null
) {
    const runner = connection || pool;
    const [result] = await runner.query(
        `INSERT INTO stock_movements
            (product_id, type, quantity, stock_before, stock_after, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [product_id, type, quantity, stock_before, stock_after, description, created_by]
    );
    return fetchMovementById(result.insertId, runner);
}

// Transactional stock adjustment with row locking:
// BEGIN -> SELECT ... FOR UPDATE -> compute -> UPDATE -> INSERT -> COMMIT.
async function createAdjustment({ product_id, quantity, type, description = null, created_by = null }) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [products] = await conn.query('SELECT id, stock FROM products WHERE id = ? FOR UPDATE', [
            product_id,
        ]);
        if (products.length === 0) {
            const err = new Error('Produk tidak ditemukan');
            err.status = 404;
            throw err;
        }

        const stockBefore = products[0].stock;
        let stockAfter;
        if (type === 'in') {
            stockAfter = stockBefore + quantity;
        } else if (type === 'out') {
            stockAfter = stockBefore - quantity;
        } else {
            const err = new Error('Tipe pergerakan tidak valid');
            err.status = 400;
            throw err;
        }

        if (stockAfter < 0) {
            const err = new Error('Stok tidak mencukupi');
            err.status = 409;
            throw err;
        }

        await conn.query('UPDATE products SET stock = ? WHERE id = ?', [stockAfter, product_id]);

        const [inserted] = await conn.query(
            `INSERT INTO stock_movements
                (product_id, type, quantity, stock_before, stock_after, description, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [product_id, type, quantity, stockBefore, stockAfter, description, created_by]
        );

        await conn.commit();

        const movement = await fetchMovementById(inserted.insertId);
        const product = await getProductStock(product_id);
        return { product, movement, stock_before: stockBefore, stock_after: stockAfter };
    } catch (err) {
        try {
            await conn.rollback();
        } catch (rollbackErr) {
            // ignore rollback errors, original error matters
        }
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    MOVEMENT_TYPES,
    ADJUSTMENT_TYPES,
    getStockList,
    getProductStock,
    getMovements,
    createMovement,
    createAdjustment,
};
