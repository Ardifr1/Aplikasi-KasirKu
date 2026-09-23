// Phase 1 health probe: verifies the mysql2 pool can reach MySQL.
// Usage: npm run db:health
const pool = require('./database');

async function main() {
    await pool.testConnection();
    const [rows] = await pool.query('SELECT 1 AS ok');
    console.log(`DB OK: ${JSON.stringify(rows[0])} (${pool.config.database}@${pool.config.host}:${process.env.DB_PORT || 3306})`);
    await pool.end();
}

main().catch(async (err) => {
    console.error(`DB FAILED: ${err.message}`);
    try {
        await pool.end();
    } catch (e) {
        // ignore close errors
    }
    process.exit(1);
});
