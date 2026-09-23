const crypto = require('crypto');
const pool = require('../config/database');

// Exact ENUM values from database/schema.sql — never invent others.
const PAYMENT_METHODS = ['cash', 'qris', 'transfer', 'debit', 'credit', 'ewallet'];
const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'refunded'];
const TXN_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'];
const TXN_STATUSES = ['draft', 'completed', 'cancelled', 'refunded'];

// Accept client alias "e_wallet" and normalize to schema value "ewallet".
function normalizePaymentMethod(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const t = value.trim().toLowerCase();
    if (t === 'e_wallet') {
        return 'ewallet';
    }
    return t;
}

function generateInvoiceNumber() {
    const d = new Date();
    const ymd =
        String(d.getFullYear()) +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0');
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `INV-${ymd}-${rand}`;
}

function toCents(value) {
    return Math.round(Number(value) * 100);
}

function fromCents(cents) {
    return Number((cents / 100).toFixed(2));
}

function toMoneyString(cents) {
    return (cents / 100).toFixed(2);
}

function formatTransactionRow(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        invoice_number: row.invoice_number,
        cashier: row.cashier_id
            ? {
                  id: row.cashier_id,
                  name: row.cashier_name,
                  username: row.cashier_username,
              }
            : null,
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        tax: Number(row.tax),
        total: Number(row.total),
        payment_status: row.payment_status,
        transaction_status: row.transaction_status,
        payment_method: row.payment_method || null,
        payment_amount:
            row.payment_amount === null || row.payment_amount === undefined
                ? null
                : Number(row.payment_amount),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

const SELECT_TXN = `SELECT t.id, t.invoice_number, t.cashier_id, t.subtotal,
            t.discount, t.tax, t.total, t.payment_status, t.transaction_status,
            t.created_at, t.updated_at,
            u.name AS cashier_name, u.username AS cashier_username,
            pay.method AS payment_method, pay.amount AS payment_amount
     FROM transactions t
     LEFT JOIN users u ON u.id = t.cashier_id
     LEFT JOIN payments pay ON pay.transaction_id = t.id`;

function buildListConditions(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.search !== undefined && filters.search !== null && String(filters.search).trim() !== '') {
        conditions.push('t.invoice_number LIKE ?');
        params.push(`%${String(filters.search).trim()}%`);
    }

    if (
        filters.cashier_id !== undefined &&
        filters.cashier_id !== null &&
        String(filters.cashier_id).trim() !== ''
    ) {
        conditions.push('t.cashier_id = ?');
        params.push(parseInt(String(filters.cashier_id).trim(), 10));
    }

    if (filters.status !== undefined && filters.status !== null && String(filters.status).trim() !== '') {
        conditions.push('t.transaction_status = ?');
        params.push(String(filters.status).trim());
    }

    if (
        filters.payment_status !== undefined &&
        filters.payment_status !== null &&
        String(filters.payment_status).trim() !== ''
    ) {
        conditions.push('t.payment_status = ?');
        params.push(String(filters.payment_status).trim());
    }

    if (
        filters.payment_method !== undefined &&
        filters.payment_method !== null &&
        String(filters.payment_method).trim() !== ''
    ) {
        conditions.push('pay.method = ?');
        params.push(normalizePaymentMethod(filters.payment_method));
    }

    if (
        filters.date_from !== undefined &&
        filters.date_from !== null &&
        String(filters.date_from).trim() !== ''
    ) {
        conditions.push('t.created_at >= ?');
        params.push(String(filters.date_from).trim());
    }

    if (
        filters.date_to !== undefined &&
        filters.date_to !== null &&
        String(filters.date_to).trim() !== ''
    ) {
        conditions.push('t.created_at <= ?');
        params.push(String(filters.date_to).trim());
    }

    return { conditions, params };
}

async function findAll(filters = {}) {
    const { conditions, params } = buildListConditions(filters);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(`${SELECT_TXN} ${where} ORDER BY t.id DESC`, params);
    return rows.map(formatTransactionRow);
}

async function findMyTransactions(userId, filters = {}) {
    // Always force the authenticated user's id — never trust a client user_id.
    const merged = { ...filters, cashier_id: userId };
    return findAll(merged);
}

async function findById(id) {
    const [txnRows] = await pool.query(`${SELECT_TXN} WHERE t.id = ? LIMIT 1`, [id]);
    if (!txnRows[0]) {
        return null;
    }
    const transaction = formatTransactionRow(txnRows[0]);

    const [items] = await pool.query(
        `SELECT ti.id, ti.transaction_id, ti.product_id, ti.quantity,
                ti.price, ti.subtotal,
                p.name AS product_name, p.barcode AS product_barcode
         FROM transaction_items ti
         LEFT JOIN products p ON p.id = ti.product_id
         WHERE ti.transaction_id = ?
         ORDER BY ti.id ASC`,
        [id]
    );

    const [payments] = await pool.query(
        `SELECT id, transaction_id, method, amount, reference, status, paid_at
         FROM payments
         WHERE transaction_id = ?
         ORDER BY id ASC`,
        [id]
    );

    const mappedItems = items.map((r) => ({
        id: r.id,
        product: {
            id: r.product_id,
            name: r.product_name,
            barcode: r.product_barcode,
        },
        quantity: r.quantity,
        price: Number(r.price),
        subtotal: Number(r.subtotal),
    }));

    const mappedPayments = payments.map((r) => ({
        id: r.id,
        method: r.method,
        amount: Number(r.amount),
        reference: r.reference,
        status: r.status,
        paid_at: r.paid_at,
    }));

    const primary = mappedPayments[0] || null;
    const change =
        primary && primary.method === 'cash'
            ? Number((primary.amount - transaction.total).toFixed(2))
            : 0;

    return {
        ...transaction,
        items: mappedItems,
        payment: primary,
        payments: mappedPayments,
        change,
    };
}

// Low-level inserts used inside checkout's connection. Each accepts an
// optional connection so they participate in the caller's transaction.
async function createTransaction(
    { invoice_number, cashier_id, subtotal, discount, tax, total },
    connection = null
) {
    const runner = connection || pool;
    const [result] = await runner.query(
        `INSERT INTO transactions
            (invoice_number, cashier_id, subtotal, discount, tax, total,
             payment_status, transaction_status)
         VALUES (?, ?, ?, ?, ?, ?, 'paid', 'completed')`,
        [invoice_number, cashier_id, subtotal, discount, tax, total]
    );
    return result.insertId;
}

async function createTransactionItem({ transaction_id, product_id, quantity, price, subtotal }, connection = null) {
    const runner = connection || pool;
    const [result] = await runner.query(
        `INSERT INTO transaction_items
            (transaction_id, product_id, quantity, price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [transaction_id, product_id, quantity, price, subtotal]
    );
    return result.insertId;
}

async function createPayment({ transaction_id, method, amount, reference = null }, connection = null) {
    const runner = connection || pool;
    const [result] = await runner.query(
        `INSERT INTO payments
            (transaction_id, method, amount, reference, status, paid_at)
         VALUES (?, ?, ?, ?, 'success', NOW())`,
        [transaction_id, method, amount, reference]
    );
    return result.insertId;
}

// Normalize duplicate product_ids by summing quantities so stock is never
// processed twice for the same product.
function normalizeItems(items) {
    const map = new Map();
    for (const item of items) {
        const pid = parseInt(String(item.product_id).trim(), 10);
        const qty =
            typeof item.quantity === 'number'
                ? item.quantity
                : parseInt(String(item.quantity).trim(), 10);
        map.set(pid, (map.get(pid) || 0) + qty);
    }
    return [...map.entries()]
        .map(([product_id, quantity]) => ({ product_id, quantity }))
        .sort((a, b) => a.product_id - b.product_id);
}

// Atomic checkout: BEGIN -> lock products FOR UPDATE -> validate stock ->
// compute from DB prices -> insert txn/items/payment -> update stock ->
// insert movements -> COMMIT. Any failure rolls everything back.
async function checkout({ cashierId, items, discount = 0, tax = 0, payment }) {
    const normalized = normalizeItems(items);
    if (normalized.length === 0) {
        const err = new Error('Item tidak valid');
        err.status = 400;
        throw err;
    }

    const discountCents = toCents(discount);
    const taxCents = toCents(tax);
    if (!Number.isInteger(discountCents) || discountCents < 0) {
        const err = new Error('Diskon tidak valid');
        err.status = 400;
        throw err;
    }
    if (!Number.isInteger(taxCents) || taxCents < 0) {
        const err = new Error('Pajak tidak valid');
        err.status = 400;
        throw err;
    }

    const method = normalizePaymentMethod(payment.method);
    if (!PAYMENT_METHODS.includes(method)) {
        const err = new Error('Metode pembayaran tidak valid');
        err.status = 400;
        throw err;
    }
    const paymentCents = toCents(payment.amount);
    if (!Number.isInteger(paymentCents) || paymentCents <= 0) {
        const err = new Error('Nominal pembayaran tidak valid');
        err.status = 400;
        throw err;
    }
    const reference =
        payment.reference === undefined || payment.reference === null
            ? null
            : String(payment.reference).trim() === ''
              ? null
              : String(payment.reference).trim();

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Lock all involved product rows in stable id order (deadlock-safe).
        const ids = normalized.map((i) => i.product_id);
        const placeholders = ids.map(() => '?').join(', ');
        const [products] = await conn.query(
            `SELECT id, name, price, stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
            ids
        );

        if (products.length !== ids.length) {
            const found = new Set(products.map((p) => p.id));
            const missing = ids.find((id) => !found.has(id));
            const err = new Error(`Produk tidak ditemukan (id ${missing})`);
            err.status = 404;
            throw err;
        }

        const byId = new Map(products.map((p) => [p.id, p]));

        // Validate stock + compute line totals from DATABASE prices.
        let subtotalCents = 0;
        const lines = normalized.map(({ product_id, quantity }) => {
            const p = byId.get(product_id);
            if (p.stock < quantity) {
                const err = new Error(`Stok tidak mencukupi untuk produk ${p.name}`);
                err.status = 409;
                throw err;
            }
            const priceCents = toCents(p.price);
            const lineCents = priceCents * quantity;
            subtotalCents += lineCents;
            return {
                product_id,
                quantity,
                priceCents,
                lineCents,
                stockBefore: p.stock,
                stockAfter: p.stock - quantity,
            };
        });

        if (discountCents > subtotalCents) {
            const err = new Error('Diskon tidak boleh melebihi subtotal');
            err.status = 400;
            throw err;
        }

        const totalCents = subtotalCents - discountCents + taxCents;
        if (totalCents <= 0) {
            const err = new Error('Total transaksi tidak valid');
            err.status = 400;
            throw err;
        }
        if (paymentCents < totalCents) {
            const err = new Error('Nominal pembayaran kurang dari total');
            err.status = 400;
            throw err;
        }

        // Unique invoice with retry for concurrent collisions.
        let invoiceNumber = null;
        let transactionId = null;
        let attempts = 0;
        while (transactionId === null && attempts < 5) {
            attempts += 1;
            invoiceNumber = generateInvoiceNumber();
            try {
                const [res] = await conn.query(
                    `INSERT INTO transactions
                        (invoice_number, cashier_id, subtotal, discount, tax, total,
                         payment_status, transaction_status)
                     VALUES (?, ?, ?, ?, ?, ?, 'paid', 'completed')`,
                    [
                        invoiceNumber,
                        cashierId,
                        toMoneyString(subtotalCents),
                        toMoneyString(discountCents),
                        toMoneyString(taxCents),
                        toMoneyString(totalCents),
                    ]
                );
                transactionId = res.insertId;
            } catch (err) {
                if (err && err.code === 'ER_DUP_ENTRY' && attempts < 5) {
                    continue;
                }
                throw err;
            }
        }
        if (transactionId === null) {
            throw new Error('Gagal membuat nomor invoice');
        }

        for (const line of lines) {
            await conn.query(
                `INSERT INTO transaction_items
                    (transaction_id, product_id, quantity, price, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    transactionId,
                    line.product_id,
                    line.quantity,
                    toMoneyString(line.priceCents),
                    toMoneyString(line.lineCents),
                ]
            );
        }

        await conn.query(
            `INSERT INTO payments
                (transaction_id, method, amount, reference, status, paid_at)
             VALUES (?, ?, ?, ?, 'success', NOW())`,
            [transactionId, method, toMoneyString(paymentCents), reference]
        );

        for (const line of lines) {
            await conn.query('UPDATE products SET stock = ? WHERE id = ?', [
                line.stockAfter,
                line.product_id,
            ]);
            await conn.query(
                `INSERT INTO stock_movements
                    (product_id, type, quantity, stock_before, stock_after,
                     description, created_by)
                 VALUES (?, 'out', ?, ?, ?, ?, ?)`,
                [
                    line.product_id,
                    line.quantity,
                    line.stockBefore,
                    line.stockAfter,
                    `Penjualan ${invoiceNumber}`,
                    cashierId,
                ]
            );
        }

        await conn.commit();

        const detail = await findById(transactionId);
        return detail;
    } catch (err) {
        try {
            await conn.rollback();
        } catch (rollbackErr) {
            // original error matters, ignore rollback errors
        }
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    TXN_PAYMENT_STATUSES,
    TXN_STATUSES,
    normalizePaymentMethod,
    generateInvoiceNumber,
    findAll,
    findMyTransactions,
    findById,
    createTransaction,
    createTransactionItem,
    createPayment,
    checkout,
};
