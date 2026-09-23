const DashboardModel = require('../models/DashboardModel');

function isDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return false;
    }
    const d = new Date(value.trim());
    return !Number.isNaN(d.getTime());
}

function validateRange(query) {
    const errors = {};
    const { date_from, date_to } = query || {};

    if (date_from !== undefined && date_from !== '' && !isDateOnly(date_from)) {
        errors.date_from = 'Format tanggal tidak valid (YYYY-MM-DD)';
    }
    if (date_to !== undefined && date_to !== '' && !isDateOnly(date_to)) {
        errors.date_to = 'Format tanggal tidak valid (YYYY-MM-DD)';
    }
    if (
        Object.keys(errors).length === 0 &&
        date_from &&
        date_to &&
        date_from.trim() !== '' &&
        date_to.trim() !== '' &&
        date_from.trim() > date_to.trim()
    ) {
        errors.date_to = 'date_to harus >= date_from';
    }
    return errors;
}

function pickRange(query) {
    const q = query || {};
    const hasFrom = q.date_from && String(q.date_from).trim() !== '';
    const hasTo = q.date_to && String(q.date_to).trim() !== '';
    if (!hasFrom && !hasTo) {
        return DashboardModel.resolveRange(null, null);
    }
    const from = hasFrom ? String(q.date_from).trim() : String(q.date_to).trim();
    const to = hasTo ? String(q.date_to).trim() : String(q.date_from).trim();
    return DashboardModel.resolveRange(from, to);
}

async function summary(req, res, next) {
    try {
        const errors = validateRange(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickRange(req.query);
        const data = await DashboardModel.getSummary(range);
        const comparison = await DashboardModel.getComparison(range);
        return res.json({
            success: true,
            message: 'Dashboard retrieved successfully',
            data: {
                summary: data,
                comparison: {
                    sales_change: comparison.sales_change,
                    transaction_change: comparison.transaction_change,
                },
                range: {
                    date_from: DashboardModel.toISODate(range.startDate),
                    date_to: DashboardModel.toISODate(
                        new Date(range.endExclusiveDate.getTime() - 1)
                    ),
                },
            },
        });
    } catch (err) {
        return next(err);
    }
}

async function salesSummary(req, res, next) {
    try {
        const errors = validateRange(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickRange(req.query);
        const data = await DashboardModel.getDailySales(range);
        return res.json({
            success: true,
            message: 'Sales summary retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function topProducts(req, res, next) {
    try {
        const errors = validateRange(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const { limit } = req.query || {};
        if (limit !== undefined && limit !== '' && !/^\d+$/.test(String(limit).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { limit: 'Limit tidak valid' },
            });
        }
        const range = pickRange(req.query);
        const data = await DashboardModel.getTopProducts({ ...range, limit });
        return res.json({
            success: true,
            message: 'Top products retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function paymentSummary(req, res, next) {
    try {
        const errors = validateRange(req.query);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }
        const range = pickRange(req.query);
        const data = await DashboardModel.getPaymentSummary(range);
        return res.json({
            success: true,
            message: 'Payment summary retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

async function lowStock(req, res, next) {
    try {
        const data = await DashboardModel.getLowStock(5);
        return res.json({
            success: true,
            message: 'Low stock retrieved successfully',
            data,
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    summary,
    salesSummary,
    topProducts,
    paymentSummary,
    lowStock,
};
