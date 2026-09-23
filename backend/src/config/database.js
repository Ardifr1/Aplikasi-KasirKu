const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: env.db.connectionLimit,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
});

async function testConnection() {
    const conn = await pool.getConnection();
    try {
        await conn.ping();
    } finally {
        conn.release();
    }
}

module.exports = pool;
module.exports.testConnection = testConnection;
module.exports.config = {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    database: env.db.database,
};
