// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    // Never leak stack traces, SQL, secrets, or hashes to clients.
    const status = err.status || err.statusCode || 500;
    const message =
        status >= 500 ? 'Terjadi kesalahan pada server' : err.message || 'Terjadi kesalahan';

    if (status >= 500) {
        console.error(`[ERROR] ${req.method} ${req.url}: ${err.message}`);
    }

    res.status(status).json({
        success: false,
        message,
    });
}

module.exports = errorHandler;
