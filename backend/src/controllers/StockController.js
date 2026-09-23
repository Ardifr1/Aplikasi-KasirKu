const StockModel = require('../models/StockModel');
const logActivity = require('../utils/activity');
const { notifyLowStock } = require('../utils/lowStock');

const VALID_LIST_TYPES = ['in', 'out', 'adjustment'];
const VALID_ADJUST_TYPES = ['in', 'out'];

function parseId(param) {
    const id = parseInt(param, 10);
    return Number.isNaN(id) || id <= 0 ? null : id;
}

function isValidDate(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }
    const t = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.test(t)) {
        return false;
    }
    const d = new Date(t);
    return !Number.isNaN(d.getTime());
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

async function stockList(req, res, next) {
    try {
        const { search, category_id, low_stock, out_of_stock } = req.query || {};
        if (
            category_id !== undefined &&
            category_id !== '' &&
            !/^\d+$/.test(String(category_id).trim())
        ) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { category_id: 'Kategori tidak valid' },
            });
        }
        const items = await StockModel.getStockList({ search, category_id, low_stock, out_of_stock });
        return res.json({
            success: true,
            message: 'Stocks retrieved successfully',
            data: items,
        });
    } catch (err) {
        return next(err);
    }
}

async function stockDetail(req, res, next) {
    try {
        const productId = parseId(req.params.productId);
        if (productId === null) {
            return res.status(400).json({
                success: false,
                message: 'ID produk tidak valid',
            });
        }
        const product = await StockModel.getProductStock(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }
        const movements = await StockModel.getMovements({ product_id: productId });
        return res.json({
            success: true,
            message: 'Stock retrieved successfully',
            data: { product, current_stock: product.stock, movements },
        });
    } catch (err) {
        return next(err);
    }
}

async function movementList(req, res, next) {
    try {
        const { product_id, type, created_by, date_from, date_to } = req.query || {};
        const errors = {};

        if (product_id !== undefined && product_id !== '' && !/^\d+$/.test(String(product_id).trim())) {
            errors.product_id = 'ID produk tidak valid';
        }
        if (created_by !== undefined && created_by !== '' && !/^\d+$/.test(String(created_by).trim())) {
            errors.created_by = 'ID pengguna tidak valid';
        }
        if (type !== undefined && type !== '' && !VALID_LIST_TYPES.includes(String(type).trim())) {
            errors.type = 'Tipe pergerakan tidak valid';
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

        const movements = await StockModel.getMovements({
            product_id,
            type,
            created_by,
            date_from,
            date_to,
        });
        return res.json({
            success: true,
            message: 'Stock movements retrieved successfully',
            data: movements,
        });
    } catch (err) {
        return next(err);
    }
}

async function adjustment(req, res, next) {
    try {
        const body = req.body || {};
        const errors = {};

        if (body.product_id === undefined || body.product_id === null || String(body.product_id).trim() === '') {
            errors.product_id = 'ID produk wajib diisi';
        } else if (!/^\d+$/.test(String(body.product_id).trim())) {
            errors.product_id = 'ID produk tidak valid';
        }

        if (body.quantity === undefined || body.quantity === null || String(body.quantity).trim() === '') {
            errors.quantity = 'Quantity wajib diisi';
        } else if (!isPositiveInteger(body.quantity)) {
            errors.quantity = 'Quantity harus bilangan bulat positif';
        }

        if (body.type === undefined || body.type === null || String(body.type).trim() === '') {
            errors.type = 'Tipe wajib diisi';
        } else if (!VALID_ADJUST_TYPES.includes(String(body.type).trim())) {
            errors.type = 'Tipe tidak valid (gunakan in atau out)';
        }

        if (body.description !== undefined && body.description !== null) {
            if (typeof body.description !== 'string') {
                errors.description = 'Deskripsi harus berupa teks';
            } else if (body.description.length > 255) {
                errors.description = 'Deskripsi maksimal 255 karakter';
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const productId = parseInt(String(body.product_id).trim(), 10);
        const quantity =
            typeof body.quantity === 'number' ? body.quantity : parseInt(String(body.quantity).trim(), 10);
        const type = String(body.type).trim();
        const description =
            body.description === undefined || body.description === null
                ? null
                : String(body.description);

        // created_by / stock_before / stock_after are NEVER taken from client
        // input — they are derived server-side inside the DB transaction.
        const result = await StockModel.createAdjustment({
            product_id: productId,
            quantity,
            type,
            description,
            created_by: req.user.id,
        });

        logActivity({
            req,
            action: 'stock.adjustment',
            module: 'stocks',
            description: `Penyesuaian stok produk id ${productId} (${type} ${quantity})`,
        });
        notifyLowStock(result.product).catch((err) => {
            console.error(`[low-stock] notify failed: ${err.message}`);
        });

        return res.status(201).json({
            success: true,
            message: 'Stok berhasil disesuaikan',
            data: result,
        });
    } catch (err) {
        if (err && (err.status === 404 || err.status === 400 || err.status === 409)) {
            const status = err.status;
            const message =
                status === 404
                    ? 'Produk tidak ditemukan'
                    : status === 409
                      ? 'Stok tidak mencukupi'
                      : err.message || 'Validasi gagal';
            return res.status(status).json({
                success: false,
                message,
            });
        }
        return next(err);
    }
}

module.exports = {
    stockList,
    stockDetail,
    movementList,
    adjustment,
};
