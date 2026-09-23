const ActivityLogModel = require('../models/ActivityLogModel');

// Fire-and-forget helper: activity logging must never break the main action.
// Never pass passwords, tokens, hashes, or raw request bodies here.
function logActivity({ req, userId = null, action, module, description }) {
    try {
        const actorId = (req && req.user ? req.user.id : null) || userId;
        const ip =
            (req && (req.ip || (req.headers && req.headers['x-forwarded-for']))) || null;
        ActivityLogModel.create({
            user_id: actorId,
            action,
            module,
            description: description || null,
            ip_address: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
        }).catch((err) => {
            console.error(`[activity-log] write failed: ${err.message}`);
        });
    } catch (err) {
        console.error(`[activity-log] helper failed: ${err.message}`);
    }
}

module.exports = logActivity;
