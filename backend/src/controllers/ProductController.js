const ProductModel = require('../models/ProductModel');
const logActivity = require('../utils/activity');

function parseId(param) {
    const id = parseInt(param, 10);
    return Number.isNaN(id) || id <= 0 ? null : id;
}

function isValidMoney(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value);
    }
    if (typeof value === 'string') {
        const t = value.trim();
        return t !== '' && /^\d+(\.\d{1,2})?$/.test(t);
    }
    return false;
}

function isValidInitialStock(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value);
    }
    if (typeof value === 'string') {
        return /^\d+$/.test(value.trim());
    }
    return false;
}

function normalizeBarcode(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        return { error: true };
    }
    const t = value.trim();
    return t === '' ? null : t;
}

function validateProduct(body, { partial = false } = {}) {
    const errors = {};

    if (!partial || body.name !== undefined) {
        if (body.name === undefined || body.name === null || String(body.name).trim() === '') {
            errors.name = 'Nama produk wajib diisi';
        } else if (typeof body.name !== 'string') {
            errors.name = 'Nama produk harus berupa teks';
        } else if (body.name.trim().length > 150) {
            errors.name = 'Nama produk maksimal 150 karakter';
        }
    }

    if (!partial || body.category_id !== undefined) {
        if (
            body.category_id === undefined ||
            body.category_id === null ||
            String(body.category_id).trim() === ''
        ) {
            errors.category_id = 'Kategori wajib diisi';
        } else if (!/^\d+$/.test(String(body.category_id).trim())) {
            errors.category_id = 'Kategori tidak valid';
        }
    }

    if (!partial || body.price !== undefined) {
        if (body.price === undefined || body.price === null || String(body.price).trim() === '') {
            errors.price = 'Harga wajib diisi';
        } else if (!isValidMoney(body.price)) {
            errors.price = 'Harga tidak valid';
        } else if (Number(body.price) < 0) {
            errors.price = 'Harga tidak boleh negatif';
        }
    }

    if (!partial && body.stock !== undefined) {
        // Initial stock at creation only; post-creation changes must use
        // POST /api/stocks/adjustment.
        if (!isValidInitialStock(body.stock)) {
            errors.stock = 'Stok tidak valid';
        } else if (Number(body.stock) < 0) {
            errors.stock = 'Stok tidak boleh negatif';
        }
    }

    if (partial && body.stock !== undefined) {
        errors.stock = 'Stok hanya dapat diubah melalui endpoint stock adjustment';
    }

    if (body.barcode !== undefined && body.barcode !== null) {
        if (typeof body.barcode !== 'string') {
            errors.barcode = 'Barcode harus berupa teks';
        } else if (body.barcode.trim().length > 100) {
            errors.barcode = 'Barcode maksimal 100 karakter';
        }
    }

    if (body.image !== undefined && body.image !== null) {
        if (typeof body.image !== 'string') {
            errors.image = 'Image harus berupa teks';
        } else if (body.image.trim().length > 255) {
            errors.image = 'Image maksimal 255 karakter';
        }
    }

    return errors;
}

async function list(req, res, next) {
    try {
        const { search, category_id, barcode } = req.query || {};
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
        const products = await ProductModel.findAll({ search, category_id, barcode });
        return res.json({
            success: true,
            message: 'Products retrieved successfully',
            data: products,
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
        const product = await ProductModel.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }
        return res.json({
            success: true,
            message: 'Product retrieved successfully',
            data: product,
        });
    } catch (err) {
        return next(err);
    }
}

async function lookupByBarcode(req, res, next) {
    try {
        const barcode = req.params.barcode ? String(req.params.barcode).trim() : '';
        if (barcode === '') {
            return res.status(400).json({
                success: false,
                message: 'Barcode tidak valid',
            });
        }
        const product = await ProductModel.findByBarcode(barcode);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }
        return res.json({
            success: true,
            message: 'Product retrieved successfully',
            data: product,
        });
    } catch (err) {
        return next(err);
    }
}

async function create(req, res, next) {
    try {
        const errors = validateProduct(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const categoryId = parseInt(String(req.body.category_id).trim(), 10);
        const categoryOk = await ProductModel.categoryExists(categoryId);
        if (!categoryOk) {
            return res.status(404).json({
                success: false,
                message: 'Kategori tidak ditemukan',
            });
        }

        const barcode = normalizeBarcode(req.body.barcode);
        if (barcode && barcode.error) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: { barcode: 'Barcode harus berupa teks' },
            });
        }

        if (barcode) {
            const taken = await ProductModel.barcodeExists(barcode);
            if (taken) {
                return res.status(409).json({
                    success: false,
                    message: 'Barcode sudah digunakan',
                });
            }
        }

        const product = await ProductModel.create({
            category_id: categoryId,
            name: req.body.name.trim(),
            barcode,
            price: Number(req.body.price),
            stock: req.body.stock === undefined ? 0 : parseInt(String(req.body.stock).trim(), 10),
            image:
                req.body.image === undefined || req.body.image === null
                    ? null
                    : String(req.body.image).trim() === ''
                      ? null
                      : String(req.body.image).trim(),
        });

        logActivity({
            req,
            action: 'product.create',
            module: 'products',
            description: `Membuat produk ${product.name}`,
        });

        return res.status(201).json({
            success: true,
            message: 'Produk berhasil dibuat',
            data: product,
        });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Barcode sudah digunakan',
            });
        }
        if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(404).json({
                success: false,
                message: 'Kategori tidak ditemukan',
            });
        }
        return next(err);
    }
}

async function update(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }

        const errors = validateProduct(req.body || {}, { partial: true });
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const existing = await ProductModel.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        const patch = {};
        if (req.body.category_id !== undefined) {
            const categoryId = parseInt(String(req.body.category_id).trim(), 10);
            const categoryOk = await ProductModel.categoryExists(categoryId);
            if (!categoryOk) {
                return res.status(404).json({
                    success: false,
                    message: 'Kategori tidak ditemukan',
                });
            }
            patch.category_id = categoryId;
        }
        if (req.body.name !== undefined) {
            patch.name = req.body.name.trim();
        }
        if (req.body.barcode !== undefined) {
            const barcode = normalizeBarcode(req.body.barcode);
            if (barcode && barcode.error) {
                return res.status(400).json({
                    success: false,
                    message: 'Validasi gagal',
                    errors: { barcode: 'Barcode harus berupa teks' },
                });
            }
            if (barcode) {
                const taken = await ProductModel.barcodeExists(barcode, id);
                if (taken) {
                    return res.status(409).json({
                        success: false,
                        message: 'Barcode sudah digunakan',
                    });
                }
            }
            patch.barcode = barcode;
        }
        if (req.body.price !== undefined) {
            patch.price = Number(req.body.price);
        }
        // Stock is intentionally NOT patchable here. All post-creation stock
        // changes must go through POST /api/stocks/adjustment.
        if (req.body.image !== undefined) {
            patch.image =
                req.body.image === null
                    ? null
                    : String(req.body.image).trim() === ''
                      ? null
                      : String(req.body.image).trim();
        }

        const updated = await ProductModel.update(id, patch);
        logActivity({
            req,
            action: 'product.update',
            module: 'products',
            description: `Memperbarui produk id ${id}`,
        });
        return res.json({
            success: true,
            message: 'Produk berhasil diperbarui',
            data: updated,
        });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Barcode sudah digunakan',
            });
        }
        return next(err);
    }
}

async function remove(req, res, next) {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: 'ID tidak valid',
            });
        }

        const existing = await ProductModel.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        try {
            const deleted = await ProductModel.remove(id);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Produk tidak ditemukan',
                });
            }
        } catch (err) {
            if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.status(409).json({
                    success: false,
                    message: 'Produk tidak dapat dihapus karena memiliki riwayat bisnis',
                });
            }
            throw err;
        }

        logActivity({
            req,
            action: 'product.delete',
            module: 'products',
            description: `Menghapus produk ${existing.name}`,
        });

        return res.json({
            success: true,
            message: 'Produk berhasil dihapus',
            data: null,
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    list,
    detail,
    lookupByBarcode,
    create,
    update,
    remove,
};
