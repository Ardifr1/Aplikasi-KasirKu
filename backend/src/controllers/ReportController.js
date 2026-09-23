const DashboardModel = require('../models/DashboardModel');
const ReportModel = require('../models/ReportModel');
const TransactionModel = require('../models/TransactionModel');

const VALID_TXN_STATUSES = ['draft', 'completed', 'cancelled', 'refunded'];

function isDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return false;
    }
    return !Number.isNaN(new Date(value.trim()).getTime());
}

function validateCommon(query) {
    const errors = {};
    const { date_from, date_to, cashier_id, category_id, payment_method, status } = query || {};

    if (date_from !== undefined && date_from !== '' && !isDateOnly(date_from)) {
        errors.date_from = 'Format tanggal tidak valid (YYYY-MM-DD)';
    }
    if (date_to !== undefined && date_to !== '' && !isDateOnly(date_to)) {
        errors.date_to = 'Format tanggal tidak valid (YYYY-MM-DD)';
    }
    if (
        date_from &&
        date_to &&
        String(date_from).trim() !== '' &&
        String(date_to).trim() !== '' &&
        !errors.date_from &&
        !errors.date_to &&
        String(date_from).trim() > String(date_to).trim()
    ) {
        errors.date_to = 'date_to harus >= date_from';
    }
    if (cashier_id !== undefined && cashier_id !== '' && !/^\d+$/.test(String(cashier_id).trim())) {
        errors.cashier_id = 'ID kasir tidak valid';
    }
    if (category_id !== undefined && category_id !== '' && !/^\d+$/.test(String(category_id).trim())) {
        errors.category_id = 'ID kategori tidak valid';
    }
    if (
        payment_method !== undefined &&
        payment_method !== '' &&
        !TransactionModel.PAYMENT_METHODS.includes(
            TransactionModel.normalizePaymentMethod(payment_method)
        )
    ) {
        errors.payment_method = 'Metode pembayaran tidak valid';
    }
    if (status !== undefined && status !== '' && !VALID_TXN_STATUSES.includes(String(status).trim())) {
        errors.status = 'Status tidak valid';
    }
    return errors;
}

// Open-ended range: date_from defaults to 30 days ago, date_to defaults to now.
function pickOpenRange(query) {
    const q = query || {};
    const hasFrom = q.date_from && String(q.date_from).trim() !== '';
    const hasTo = q.date_to && String(q.date_to).trim() !== '';
    if (hasFrom || hasTo) {
        return DashboardModel.resolveRange(
            hasFrom ? String(q.date_from).trim() : String(q.date_to).trim(),
            hasTo ? String(q.date_to).trim() : String(q.date_from).trim()
        );
    }
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    to.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return DashboardModel.resolveRange(fmt(from), fmt(to));
}

function collectFilters(query, range) {
    const q = query || {};
    return {
        start: range.start,
        exclusiveEnd: range.exclusiveEnd,
        cashier_id: q.cashier_id,
        payment_method: q.payment_method,
        status: q.status,
        category_id: q.category_id,
    };
}

async function sales(req, res, next) {
    try {
        const errors = validateCommon(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickOpenRange(req.query);
        const data = await ReportModel.getSalesReport(collectFilters(req.query, range));
        return res.json({
            success: true,
            message: 'Sales report retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function salesSummary(req, res, next) {
    try {
        const errors = validateCommon(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickOpenRange(req.query);
        const data = await ReportModel.getSalesSummary(collectFilters(req.query, range));
        return res.json({
            success: true,
            message: 'Sales summary retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function products(req, res, next) {
    try {
        const errors = validateCommon(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickOpenRange(req.query);
        const data = await ReportModel.getProductReport(collectFilters(req.query, range));
        return res.json({
            success: true,
            message: 'Product report retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function cashiers(req, res, next) {
    try {
        const errors = validateCommon(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickOpenRange(req.query);
        const data = await ReportModel.getCashierReport(collectFilters(req.query, range));
        return res.json({
            success: true,
            message: 'Cashier report retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function salesExport(req, res, next) {
    try {
        const errors = validateCommon(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickOpenRange(req.query);
        const rows = await ReportModel.getSalesReport(collectFilters(req.query, range));
        const csv = ReportModel.toSalesCsv(rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
        return res.send(csv);
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    sales,
    salesSummary,
    products,
    cashiers,
    salesExport,
};
