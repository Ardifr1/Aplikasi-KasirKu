const pool = require('../config/database');
const DashboardModel = require('./DashboardModel');
const { normalizePaymentMethod } = require('./TransactionModel');

const { COMPLETED_TXN } = DashboardModel;

function buildSalesConditions(filters = {}, alias = 't') {
    const conditions = [`${alias}.created_at >= ?`, `${alias}.created_at < ?`];
    const params = [filters.start, filters.exclusiveEnd];

    if (
        filters.cashier_id !== undefined &&
        filters.cashier_id !== null &&
        String(filters.cashier_id).trim() !== ''
    ) {
        conditions.push(`${alias}.cashier_id = ?`);
        params.push(parseInt(String(filters.cashier_id).trim(), 10));
    }

    if (filters.status !== undefined && filters.status !== null && String(filters.status).trim() !== '') {
        conditions.push(`${alias}.transaction_status = ?`);
        params.push(String(filters.status).trim());
    }

    return { conditions, params };
}

// Sales-level rows: invoice, date, cashier, money, payment info.
async function getSalesReport(filters = {}) {
    const { conditions, params } = buildSalesConditions(filters, 't');
    const extraParams = [];

    let paymentJoin = 'LEFT JOIN payments pay ON pay.transaction_id = t.id';
    if (
        filters.payment_method !== undefined &&
        filters.payment_method !== null &&
        String(filters.payment_method).trim() !== ''
    ) {
        conditions.push('pay.method = ?');
        extraParams.push(normalizePaymentMethod(filters.payment_method));
    }

    const where = `WHERE ${conditions.join(' AND ')} AND ${COMPLETED_TXN}`;
    const [rows] = await pool.query(
        `SELECT t.id, t.invoice_number, t.created_at,
                t.cashier_id, u.name AS cashier_name, u.username AS cashier_username,
                t.subtotal, t.discount, t.tax, t.total,
                t.payment_status, t.transaction_status,
                pay.method AS payment_method, pay.amount AS payment_amount,
                pay.reference AS payment_reference
         FROM transactions t
         LEFT JOIN users u ON u.id = t.cashier_id
         ${paymentJoin}
         ${where}
         ORDER BY t.id DESC`,
        [...params, ...extraParams]
    );
    return rows.map((r) => ({
        id: r.id,
        invoice: r.invoice_number,
        date: r.created_at,
        cashier: r.cashier_id
            ? { id: r.cashier_id, name: r.cashier_name, username: r.cashier_username }
            : null,
        subtotal: Number(r.subtotal),
        discount: Number(r.discount),
        tax: Number(r.tax),
        total: Number(r.total),
        payment_method: r.payment_method || null,
        payment_amount:
            r.payment_amount === null || r.payment_amount === undefined
                ? null
                : Number(r.payment_amount),
        payment_reference: r.payment_reference || null,
        payment_status: r.payment_status,
        status: r.transaction_status,
    }));
}

async function getSalesSummary(filters = {}) {
    const { conditions, params } = buildSalesConditions(filters, 't');
    const extraParams = [];

    let paymentJoin = '';
    if (
        filters.payment_method !== undefined &&
        filters.payment_method !== null &&
        String(filters.payment_method).trim() !== ''
    ) {
        paymentJoin = 'LEFT JOIN payments pay ON pay.transaction_id = t.id';
        conditions.push('pay.method = ?');
        extraParams.push(normalizePaymentMethod(filters.payment_method));
    }

    const where = `WHERE ${conditions.join(' AND ')} AND ${COMPLETED_TXN}`;
    const [txnRows] = await pool.query(
        `SELECT COUNT(*) AS total_transactions,
                COALESCE(SUM(t.total), 0) AS total_sales
         FROM transactions t
         ${paymentJoin}
         ${where}`,
        [...params, ...extraParams]
    );

    // Same filters applied to the items aggregation.
    const itemConds = [...conditions];
    const itemParams = [...params, ...extraParams];
    const [itemRows] = await pool.query(
        `SELECT COALESCE(SUM(ti.quantity), 0) AS total_items
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         ${paymentJoin}
         WHERE ${itemConds.join(' AND ')} AND ${COMPLETED_TXN.replace(/t\./g, 't.')}`,
        itemParams
    );

    const totalTransactions = Number(txnRows[0].total_transactions);
    const totalSales = Number(txnRows[0].total_sales);
    return {
        total_sales: totalSales,
        total_transactions: totalTransactions,
        total_items: Number(itemRows[0].total_items),
        average_transaction:
            totalTransactions > 0 ? Number((totalSales / totalTransactions).toFixed(2)) : 0,
    };
}

async function getProductReport(filters = {}) {
    const conditions = ['t.created_at >= ?', 't.created_at < ?'];
    const params = [filters.start, filters.exclusiveEnd];

    if (
        filters.category_id !== undefined &&
        filters.category_id !== null &&
        String(filters.category_id).trim() !== ''
    ) {
        conditions.push('p.category_id = ?');
        params.push(parseInt(String(filters.category_id).trim(), 10));
    }

    const where = `WHERE ${conditions.join(' AND ')} AND ${COMPLETED_TXN}`;
    const [rows] = await pool.query(
        `SELECT ti.product_id AS product_id,
                COALESCE(p.name, CONCAT('Product #', ti.product_id)) AS product_name,
                p.category_id AS category_id,
                c.name AS category_name,
                SUM(ti.quantity) AS quantity_sold,
                SUM(ti.subtotal) AS sales,
                COUNT(DISTINCT ti.transaction_id) AS transactions
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         ${where}
         GROUP BY ti.product_id, p.name, p.category_id, c.name
         ORDER BY quantity_sold DESC`,
        params
    );
    return rows.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
        quantity_sold: Number(r.quantity_sold),
        sales: Number(r.sales),
        transactions: Number(r.transactions),
    }));
}

async function getCashierReport(filters = {}) {
    const conditions = ['t.created_at >= ?', 't.created_at < ?'];
    const params = [filters.start, filters.exclusiveEnd];
    const where = `WHERE ${conditions.join(' AND ')} AND ${COMPLETED_TXN}`;
    const [rows] = await pool.query(
        `SELECT t.cashier_id AS cashier_id,
                COALESCE(u.name, CONCAT('User #', t.cashier_id)) AS cashier_name,
                u.username AS cashier_username,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total), 0) AS total_sales
         FROM transactions t
         LEFT JOIN users u ON u.id = t.cashier_id
         ${where}
         GROUP BY t.cashier_id, u.name, u.username
         ORDER BY total_sales DESC`,
        params
    );
    return rows.map((r) => ({
        cashier: { id: r.cashier_id, name: r.cashier_name, username: r.cashier_username },
        transactions: Number(r.transactions),
        total_sales: Number(r.total_sales),
        average_transaction:
            Number(r.transactions) > 0
                ? Number((Number(r.total_sales) / Number(r.transactions)).toFixed(2))
                : 0,
    }));
}

function escapeCsv(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const s = String(value);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function toSalesCsv(rows) {
    const header = [
        'invoice',
        'date',
        'cashier',
        'subtotal',
        'discount',
        'tax',
        'total',
        'payment_method',
        'payment_status',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
        const date = r.date instanceof Date ? r.date.toISOString() : String(r.date);
        lines.push(
            [
                escapeCsv(r.invoice),
                escapeCsv(date),
                escapeCsv(r.cashier ? r.cashier.username : ''),
                escapeCsv(r.subtotal),
                escapeCsv(r.discount),
                escapeCsv(r.tax),
                escapeCsv(r.total),
                escapeCsv(r.payment_method || ''),
                escapeCsv(r.payment_status),
            ].join(',')
        );
    }
    return lines.join('\r\n') + '\r\n';
}

module.exports = {
    getSalesReport,
    getSalesSummary,
    getProductReport,
    getCashierReport,
    toSalesCsv,
};
