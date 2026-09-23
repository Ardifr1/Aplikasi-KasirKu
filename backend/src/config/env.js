const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function required(name) {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optional(name, fallback) {
    const value = process.env[name];
    return value === undefined || value === '' ? fallback : value;
}

const env = {
    port: parseInt(optional('PORT', '3000'), 10),
    db: {
        host: optional('DB_HOST', 'localhost'),
        port: parseInt(optional('DB_PORT', '3306'), 10),
        user: required('DB_USER'),
        password: optional('DB_PASSWORD', ''),
        database: required('DB_NAME'),
        connectionLimit: parseInt(optional('DB_CONNECTION_LIMIT', '10'), 10),
    },
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: optional('JWT_EXPIRES_IN', '1d'),
};

if (Number.isNaN(env.port)) {
    throw new Error('Invalid PORT: must be a number');
}

if (Number.isNaN(env.db.port)) {
    throw new Error('Invalid DB_PORT: must be a number');
}

if (env.jwtSecret === 'change_this_secret') {
    throw new Error('JWT_SECRET must be changed from the default placeholder value');
}

module.exports = env;
