/**
 * DEVELOPMENT-ONLY seed: creates test users for local auth verification.
 *
 * Accounts (development only, never production):
 *   admin   / Admin123!
 *   kasir   / Kasir123!
 *   pemilik / Pemilik123!
 *
 * Passwords are bcrypt hashes — never plaintext. Idempotent: existing
 * usernames are left untouched so real users are never overwritten.
 *
 * Usage:
 *   node database/seeds/seedUsers.js
 * (run from C:\Kasir App\backend so ../database paths resolve)
 */
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const mysql = backendRequire('mysql2/promise');
const bcrypt = backendRequire('bcryptjs');
const env = require('../../backend/src/config/env');

const DEV_USERS = [
    { name: 'Administrator', username: 'admin', password: 'Admin123!', role: 'admin' },
    { name: 'Kasir Utama', username: 'kasir', password: 'Kasir123!', role: 'kasir' },
    { name: 'Pemilik Toko', username: 'pemilik', password: 'Pemilik123!', role: 'pemilik' },
];

async function main() {
    const connection = await mysql.createConnection({
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database: env.db.database,
        multipleStatements: true,
    });

    try {
        const [roles] = await connection.query('SELECT id, name FROM roles');
        const roleByName = new Map(roles.map((r) => [r.name, r.id]));

        for (const u of DEV_USERS) {
            const roleId = roleByName.get(u.role);
            if (!roleId) {
                throw new Error(`Role "${u.role}" tidak ditemukan. Jalankan migrate:seed dulu.`);
            }

            const [existing] = await connection.query(
                'SELECT id, username FROM users WHERE username = ? LIMIT 1',
                [u.username]
            );
            if (existing.length > 0) {
                console.log(`Skip: user "${u.username}" sudah ada (tidak ditimpa).`);
                continue;
            }

            const hash = await bcrypt.hash(u.password, 10);
            await connection.query(
                "INSERT INTO users (name, username, password, role_id, status) VALUES (?, ?, ?, ?, 'active')",
                [u.name, u.username, hash, roleId]
            );
            console.log(`Created dev user "${u.username}" with role "${u.role}".`);
        }

        console.log('Dev user seeding completed.');
    } finally {
        await connection.end();
    }
}

main().catch((err) => {
    console.error(`Seeding failed: ${err.message}`);
    process.exit(1);
});
