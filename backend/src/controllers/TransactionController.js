const TransactionModel = require('../models/TransactionModel');
const { normalizePaymentMethod } = require('../models/TransactionModel');
const logActivity = require('../utils/activity');
const { notifyLowStock } = require('../utils/lowStock');

const VALID_TXN_STATUSES = ['draft', 'completed', 'cancelled', 'refunded'];

function parseId(param) {
    const id = parseInt(param, 10);
    return Number.isNaN(id) || id <= 0 ? null : id;
}

function isValidDate(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.test(value.trim())) {
        return false;
    }
    return !Number.isNaN(new Date(value.trim()).getTime());
}

function isPositiveInteger(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value > 0;
    }
    if (typeof value === 'string') {
        return /^[1-9]\d*$/.test(value.trim());
    }
    return false;
}

function isValidMoney(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0;
    }
    if (typeof value === 'string') {
        const t = value.trim();
        return t !== '' && /^\d+(\.\d{1,2})?$/.test(t);
    }
    return false;
}

function validateCheckout(body) {
    const errors = {};

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        errors.items = 'Item transaksi wajib diisi (minimal 1 item)';
        return errors;
    }

    body.items.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
            errors[`items[${idx}]`] = 'Item tidak valid';
            return;
        }
        if (
            item.product_id === undefined ||
            item.product_id === null ||
            String(item.product_id).trim() === '' ||
            !/^\d+$/.test(String(item.product_id).trim())
        ) {
            errors[`items[${idx}].product_id`] = 'ID produk tidak valid';
        }
        if (
            item.quantity === undefined ||
            item.quantity === null ||
            String(item.quantity).trim() === '' ||
            !isPositiveInteger(item.quantity)
        ) {
            errors[`items[${idx}].quantity`] = 'Quantity harus bilangan bulat positif';
        }
    });

    if (body.discount !== undefined && body.discount !== null && String(body.discount).trim() !== '') {
        if (!isValidMoney(body.discount)) {
            errors.discount = 'Diskon tidak valid';
        }
    }

    if (body.tax !== undefined && body.tax !== null && String(body.tax).trim() !== '') {
        if (!isValidMoney(body.tax)) {
            errors.tax = 'Pajak tidak valid';
        }
    }

    if (!body.payment || typeof body.payment !== 'object') {
        errors.payment = 'Data pembayaran wajib diisi';
        return errors;
    }

    if (
        body.payment.method === undefined ||
        body.payment.method === null ||
        String(body.payment.method).trim() === ''
    ) {
        errors['payment.method'] = 'Metode pembayaran wajib diisi';
    } else {
        const m = normalizePaymentMethod(body.payment.method);
        if (!TransactionModel.PAYMENT_METHODS.includes(m)) {
            errors['payment.method'] = 'Metode pembayaran tidak valid';
        }
    }

    if (
        body.payment.amount === undefined ||
        body.payment.amount === null ||
        String(body.payment.amount).trim() === ''
    ) {
        errors['payment.amount'] = 'Nominal pembayaran wajib diisi';
    } else if (!isValidMoney(body.payment.amount) || Number(body.payment.amount) <= 0) {
        errors['payment.amount'] = 'Nominal pembayaran tidak valid';
    }

    if (body.payment.reference !== undefined && body.payment.reference !== null) {
        if (typeof body.payment.reference !== 'string') {
            errors['payment.reference'] = 'Referensi harus berupa teks';
        } else if (body.payment.reference.length > 100) {
            errors['payment.reference'] = 'Referensi maksimal 100 karakter';
        }
    }

    return errors;
}

async function list(req, res, next) {
    try {
        const { search, cashier_id, status, payment_status, payment_method, date_from, date_to } =
            req.query || {};
        const errors = {};
        if (cashier_id !== undefined && cashier_id !== '' && !/^\d+$/.test(String(cashier_id).trim())) {
            errors.cashier_id = 'ID kasir tidak valid';
        }
        if (status !== undefined && status !== '' && !VALID_TXN_STATUSES.includes(String(status).trim())) {
            errors.status = 'Status tidak valid';
        }
        if (date_from !== undefined && date_from !== '' && !isValidDate(date_from)) {
            errors.date_from = 'Format tanggal tidak valid (YYYY-MM-DD)';
        }
        if (date_to !== undefined && date_to !== '' && !isValidDate(date_to)) {
            errors.date_to = 'Format tanggal tidak valid (YYYY-MM-DD)';
        }
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const rows = await TransactionModel.findAll({
            search,
            cashier_id,
            status,
            payment_status,
            payment_method,
            date_from,
            date_to,
        });
        return res.json({
            success: true,
            message: 'Transactions retrieved successfully',
            data: rows,
        });
    } catch (err) {
        return next(err);
    }
}

async function myTransactions(req, res, next) {
    try {
        // Never trust a client user_id — always use the authenticated user.
        const rows = await TransactionModel.findMyTransactions(req.user.id, req.query || {});
        return res.json({
            success: true,
            message: 'My transactions retrieved successfully',
            data: rows,
        });
    } catch (err) {
        return next(err);
    }
}

async function detail(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }
        const txn = await TransactionModel.findById(id);
        if (!txn) {
            return res.status(404).json({
                success: false,
                message: 'Transaksi tidak ditemukan',
            });
        }
        return res.json({
            success: true,
            message: 'Transaction retrieved successfully',
            data: txn,
        });
    } catch (err) {
        return next(err);
    }
}

async function create(req, res, next) {
    try {
        const errors = validateCheckout(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        // Server-controlled only: cashier/invoice/prices/totals/statuses are
        // derived inside the model transaction, never from client input.
        const detail = await TransactionModel.checkout({
            cashierId: req.user.id,
            items: req.body.items,
            discount:
                req.body.discount === undefined || req.body.discount === null || String(req.body.discount).trim() === ''
                    ? 0
                    : Number(req.body.discount),
            tax:
                req.body.tax === undefined || req.body.tax === null || String(req.body.tax).trim() === ''
                    ? 0
                    : Number(req.body.tax),
            payment: {
                method: req.body.payment.method,
                amount: Number(req.body.payment.amount),
                reference: req.body.payment.reference,
            },
        });

        logActivity({
            req,
            action: 'transaction.create',
            module: 'transactions',
            description: `Transaksi ${detail.invoice_number} total ${detail.total}`,
        });
        if (detail && Array.isArray(detail.items)) {
            for (const item of detail.items) {
                const pid = item && item.product ? item.product.id : null;
                if (pid) {
                    notifyLowStock({ id: pid }).catch(() => {});
                }
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Transaksi berhasil dibuat',
            data: detail,
        });
    } catch (err) {
        if (err && (err.status === 400 || err.status === 404 || err.status === 409)) {
            return res.status(err.status).json({
                success: false,
                message: err.message || 'Transaksi gagal',
            });
        }
        return next(err);
    }
}

module.exports = {
    list,
    myTransactions,
    detail,
    create,
};
