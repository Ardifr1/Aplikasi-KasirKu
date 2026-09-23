const pool = require('../config/database');
const StockModel = require('./StockModel');

// Single definition of a completed sale, shared by dashboard + reports.
// Matches Phase 6 checkout: transaction_status='completed', payment_status='paid'.
const COMPLETED_TXN = "t.transaction_status = 'completed' AND t.payment_status = 'paid'";

function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function toSQLDatetime(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Range: date_from >= start 00:00:00, date_to < (date_to + 1 day) 00:00:00.
// Uses range comparisons so created_at indexes remain usable.
function resolveRange(dateFrom, dateTo) {
    let start;
    let endExclusive;
    if (!dateFrom && !dateTo) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start = today;
        endExclusive = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    } else {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateTo || dateFrom);
        to.setHours(0, 0, 0, 0);
        start = from;
        endExclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    }
    return {
        start: toSQLDatetime(start),
        exclusiveEnd: toSQLDatetime(endExclusive),
        startDate: start,
        endExclusiveDate: endExclusive,
    };
}

async function getSummary({ start, exclusiveEnd }) {
    const [txnRows] = await pool.query(
        `SELECT COUNT(*) AS total_transactions,
                COALESCE(SUM(t.total), 0) AS total_sales
         FROM transactions t
         WHERE t.created_at >= ? AND t.created_at < ?
           AND ${COMPLETED_TXN}`,
        [start, exclusiveEnd]
    );
    const [itemRows] = await pool.query(
        `SELECT COALESCE(SUM(ti.quantity), 0) AS total_items
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE t.created_at >= ? AND t.created_at < ?
           AND ${COMPLETED_TXN}`,
        [start, exclusiveEnd]
    );
    const totalTransactions = Number(txnRows[0].total_transactions);
    const totalSales = Number(txnRows[0].total_sales);
    const totalItems = Number(itemRows[0].total_items);
    return {
        total_sales: totalSales,
        total_transactions: totalTransactions,
        total_items_sold: totalItems,
        average_transaction: totalTransactions > 0 ? Number((totalSales / totalTransactions).toFixed(2)) : 0,
    };
}

async function getComparison({ start, exclusiveEnd, startDate, endExclusiveDate }) {
    const durationMs = endExclusiveDate.getTime() - startDate.getTime();
    const prevEnd = startDate;
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    const current = await getSummary({ start, exclusiveEnd });
    const previous = await getSummary({
        start: toSQLDatetime(prevStart),
        exclusiveEnd: toSQLDatetime(prevEnd),
    });

    const pct = (cur, prev) => {
        if (prev === 0) {
            return cur > 0 ? 100 : 0;
        }
        return Number((((cur - prev) / prev) * 100).toFixed(2));
    };

    return {
        current,
        previous,
        sales_change: pct(current.total_sales, previous.total_sales),
        transaction_change: pct(current.total_transactions, previous.total_transactions),
    };
}

async function getDailySales({ start, exclusiveEnd }) {
    const [rows] = await pool.query(
        `SELECT DATE(t.created_at) AS date,
                COALESCE(SUM(t.total), 0) AS sales,
                COUNT(*) AS transactions
         FROM transactions t
         WHERE t.created_at >= ? AND t.created_at < ?
           AND ${COMPLETED_TXN}
         GROUP BY DATE(t.created_at)
         ORDER BY DATE(t.created_at) ASC`,
        [start, exclusiveEnd]
    );
    return rows.map((r) => ({
        date: r.date instanceof Date ? toISODate(r.date) : String(r.date).slice(0, 10),
        sales: Number(r.sales),
        transactions: Number(r.transactions),
    }));
}

async function getTopProducts({ start, exclusiveEnd, limit = 5 }) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 50);
    const [rows] = await pool.query(
        `SELECT ti.product_id AS product_id,
                COALESCE(p.name, CONCAT('Product #', ti.product_id)) AS product_name,
                SUM(ti.quantity) AS quantity_sold,
                SUM(ti.subtotal) AS sales,
                COUNT(DISTINCT ti.transaction_id) AS transactions
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
         WHERE t.created_at >= ? AND t.created_at < ?
           AND ${COMPLETED_TXN}
         GROUP BY ti.product_id, p.name
         ORDER BY quantity_sold DESC
         LIMIT ${safeLimit}`,
        [start, exclusiveEnd]
    );
    return rows.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        quantity_sold: Number(r.quantity_sold),
        sales: Number(r.sales),
        transactions: Number(r.transactions),
    }));
}

async function getPaymentSummary({ start, exclusiveEnd }) {
    const [rows] = await pool.query(
        `SELECT pay.method AS method,
                COUNT(*) AS transactions,
                COALESCE(SUM(pay.amount), 0) AS amount
         FROM payments pay
         JOIN transactions t ON t.id = pay.transaction_id
         WHERE t.created_at >= ? AND t.created_at < ?
           AND ${COMPLETED_TXN}
           AND pay.status = 'success'
         GROUP BY pay.method
         ORDER BY amount DESC`,
        [start, exclusiveEnd]
    );
    return rows.map((r) => ({
        method: r.method,
        transactions: Number(r.transactions),
        amount: Number(r.amount),
    }));
}

// Reuses existing stock logic instead of duplicating low-stock rules:
// low (1..5) + out-of-stock (<=0) combined = stock <= 5.
async function getLowStock(threshold = 5) {
    const low = await StockModel.getStockList({ low_stock: threshold });
    const empty = await StockModel.getStockList({ out_of_stock: true });
    const merged = [...empty, ...low].sort((a, b) => a.stock - b.stock);
    return merged;
}

module.exports = {
    COMPLETED_TXN,
    resolveRange,
    toISODate,
    getSummary,
    getComparison,
    getDailySales,
    getTopProducts,
    getPaymentSummary,
    getLowStock,
};
