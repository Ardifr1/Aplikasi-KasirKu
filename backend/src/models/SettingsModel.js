const pool = require('../config/database');

const ALLOWED_FIELDS = ['store_name', 'address', 'business_number', 'email', 'logo'];

function formatRow(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        store_name: row.store_name,
        address: row.address,
        business_number: row.business_number,
        email: row.email,
        logo: row.logo,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function get() {
    const [rows] = await pool.query(
        `SELECT id, store_name, address, business_number, email, logo,
                updated_by, created_at, updated_at
         FROM store_settings
         ORDER BY id ASC
         LIMIT 1`
    );
    return formatRow(rows[0]);
}

async function upsert(fields, updatedBy) {
    const existing = await get();
    const cols = [];
    const params = [];
    for (const key of ALLOWED_FIELDS) {
        if (fields[key] !== undefined) {
            cols.push(key);
            params.push(fields[key]);
        }
    }
    if (cols.length === 0) {
        return existing;
    }
    if (!existing) {
        const names = [...cols, 'updated_by'].join(', ');
        const placeholders = [...cols.map(() => '?'), '?'].join(', ');
        const [result] = await pool.query(
            `INSERT INTO store_settings (${names}) VALUES (${placeholders})`,
            [...params, updatedBy]
        );
        const [rows] = await pool.query(
            'SELECT * FROM store_settings WHERE id = ? LIMIT 1',
            [result.insertId]
        );
        return formatRow(rows[0]);
    }
    const sets = [...cols.map((c) => `${c} = ?`), 'updated_by = ?'].join(', ');
    await pool.query(`UPDATE store_settings SET ${sets} WHERE id = ?`, [
        ...params,
        updatedBy,
        existing.id,
    ]);
    return get();
}

module.exports = {
    ALLOWED_FIELDS,
    get,
    upsert,
};
