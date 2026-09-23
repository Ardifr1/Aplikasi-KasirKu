const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
const mysql = backendRequire('mysql2/promise');
const env = require('../backend/src/config/env');

async function runFile(connection, filePath) {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running ${path.relative(process.cwd(), filePath)} ...`);
    await connection.query(sql);
}

async function main() {
    const args = process.argv.slice(2);
    const withSeeds = args.includes('--seed');

    // Connect WITHOUT database first so CREATE DATABASE works.
    const connection = await mysql.createConnection({
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        multipleStatements: true,
    });

    try {
        await runFile(connection, path.join(__dirname, 'schema.sql'));

        if (withSeeds) {
            const seedsDir = path.join(__dirname, 'seeds');
            const files = fs
                .readdirSync(seedsDir)
                .filter((f) => f.endsWith('.sql'))
                .sort();
            for (const file of files) {
                await runFile(connection, path.join(seedsDir, file));
            }
        }

        console.log('Migration completed successfully.');
    } finally {
        await connection.end();
    }
}

main().catch((err) => {
    console.error(`Migration failed: ${err.message}`);
    process.exit(1);
});
