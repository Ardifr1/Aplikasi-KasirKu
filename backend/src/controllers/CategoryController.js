const CategoryModel = require('../models/CategoryModel');
const logActivity = require('../utils/activity');

function parseId(param) {
    const id = parseInt(param, 10);
    return Number.isNaN(id) || id <= 0 ? null : id;
}

function validateCategory(body, { partial = false } = {}) {
    const errors = {};

    if (!partial || body.name !== undefined) {
        if (body.name === undefined || body.name === null || String(body.name).trim() === '') {
            errors.name = 'Nama kategori wajib diisi';
        } else if (typeof body.name !== 'string') {
            errors.name = 'Nama kategori harus berupa teks';
        } else if (body.name.trim().length > 100) {
            errors.name = 'Nama kategori maksimal 100 karakter';
        }
    }

    if (body.description !== undefined && body.description !== null) {
        if (typeof body.description !== 'string') {
            errors.description = 'Deskripsi harus berupa teks';
        }
    }

    return errors;
}

async function list(req, res, next) {
    try {
        const categories = await CategoryModel.findAll();
        return res.json({
            success: true,
            message: 'Categories retrieved successfully',
            data: categories,
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
        const category = await CategoryModel.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Kategori tidak ditemukan',
            });
        }
        return res.json({
            success: true,
            message: 'Category retrieved successfully',
            data: category,
        });
    } catch (err) {
        return next(err);
    }
}

async function create(req, res, next) {
    try {
        const errors = validateCategory(req.body || {});
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const name = req.body.name.trim();
        const description =
            req.body.description === undefined || req.body.description === null
                ? null
                : String(req.body.description);

        const taken = await CategoryModel.nameExists(name);
        if (taken) {
            return res.status(409).json({
                success: false,
                message: 'Nama kategori sudah digunakan',
            });
        }

        const category = await CategoryModel.create({ name, description });
        logActivity({
            req,
            action: 'category.create',
            module: 'categories',
            description: `Membuat kategori ${name}`,
        });
        return res.status(201).json({
            success: true,
            message: 'Kategori berhasil dibuat',
            data: category,
        });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Nama kategori sudah digunakan',
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

        const errors = validateCategory(req.body || {}, { partial: true });
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors,
            });
        }

        const existing = await CategoryModel.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Kategori tidak ditemukan',
            });
        }

        const patch = {};
        if (req.body.name !== undefined) {
            const name = req.body.name.trim();
            const taken = await CategoryModel.nameExists(name, id);
            if (taken) {
                return res.status(409).json({
                    success: false,
                    message: 'Nama kategori sudah digunakan',
                });
            }
            patch.name = name;
        }
        if (req.body.description !== undefined) {
            patch.description =
                req.body.description === null ? null : String(req.body.description);
        }

        const updated = await CategoryModel.update(id, patch);
        logActivity({
            req,
            action: 'category.update',
            module: 'categories',
            description: `Memperbarui kategori id ${id}`,
        });
        return res.json({
            success: true,
            message: 'Kategori berhasil diperbarui',
            data: updated,
        });
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Nama kategori sudah digunakan',
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

        const existing = await CategoryModel.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Kategori tidak ditemukan',
            });
        }

        // Never cascade-delete products: block when referenced.
        const used = await CategoryModel.productCount(id);
        if (used > 0) {
            return res.status(409).json({
                success: false,
                message: 'Kategori tidak dapat dihapus karena masih memiliki produk',
            });
        }

        const deleted = await CategoryModel.remove(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Kategori tidak ditemukan',
            });
        }

        logActivity({
            req,
            action: 'category.delete',
            module: 'categories',
            description: `Menghapus kategori ${existing.name}`,
        });

        return res.json({
            success: true,
            message: 'Kategori berhasil dihapus',
            data: null,
        });
    } catch (err) {
        if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                success: false,
                message: 'Kategori tidak dapat dihapus karena masih memiliki produk',
            });
        }
        return next(err);
    }
}

module.exports = {
    list,
    detail,
    create,
    update,
    remove,
};
