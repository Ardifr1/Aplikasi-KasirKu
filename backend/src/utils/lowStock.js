const pool = require('../config/database');
const NotificationModel = require('../models/NotificationModel');

const LOW_STOCK_THRESHOLD = 5;

async function currentStock(productId) {
    const [rows] = await pool.query('SELECT id, name, stock FROM products WHERE id = ? LIMIT 1', [
        productId,
    ]);
    return rows[0] || null;
}

function stateOf(stock) {
    if (stock <= 0) {
        return 'out';
    }
    if (stock <= LOW_STOCK_THRESHOLD) {
        return 'low';
    }
    return 'ok';
}

// Creates low-stock notifications for all active admins when a product is
// low (1..5) or out of stock (0). Dedups: skips when an identical unread
// notification already exists for the same product/state.
async function notifyLowStock(product) {
    let row = product;
    if (!row || row.stock === undefined) {
        row = await currentStock(product.id);
    }
    if (!row) {
        return null;
    }

    const state = stateOf(row.stock);
    if (state === 'ok') {
        return null;
    }

    const title = state === 'out' ? 'Stok habis' : 'Stok menipis';
    const message =
        state === 'out'
            ? `Stok ${row.name} habis (0). Segera restok.`
            : `Stok ${row.name} tersisa ${row.stock}. Segera restok.`;

    const adminIds = await NotificationModel.activeAdminIds();
    let created = 0;
    for (const adminId of adminIds) {
        const dup = await NotificationModel.hasIdenticalUnread(adminId, title, message);
        if (dup) {
            continue;
        }
        await NotificationModel.create({ user_id: adminId, title, message, type: 'warning' });
        created += 1;
    }
    return { state, created };
}

module.exports = {
    LOW_STOCK_THRESHOLD,
    notifyLowStock,
};
