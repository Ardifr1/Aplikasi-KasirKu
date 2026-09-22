const KasirModel = require('../models/KasirModel');

class KasirController {
    getAll(req, res) {
        const items = KasirModel.getAll();
        res.json({
            success: true,
            data: items
        });
    }

    getById(req, res) {
        const id = parseInt(req.params.id);
        const item = KasirModel.getById(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item tidak ditemukan'
            });
        }
        res.json({ success: true, data: item });
    }

    create(req, res) {
        const item = KasirModel.create(req.body);
        res.status(201).json({
            success: true,
            data: item
        });
    }

    update(req, res) {
        const id = parseInt(req.params.id);
        const item = KasirModel.update(id, req.body);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item tidak ditemukan'
            });
        }
        res.json({ success: true, data: item });
    }

    delete(req, res) {
        const id = parseInt(req.params.id);
        const item = KasirModel.delete(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item tidak ditemukan'
            });
        }
        res.json({ success: true, message: 'Berhasil dihapus' });
    }
}

module.exports = new KasirController();
