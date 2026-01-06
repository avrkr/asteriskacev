const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
