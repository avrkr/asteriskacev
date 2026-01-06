const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Topic name is required'],
        trim: true
    },
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain',
        required: [true, 'Domain is required']
    },
    description: {
        type: String
    }
}, {
    timestamps: true
});

// Compound index to ensure topic name is unique within a domain
topicSchema.index({ name: 1, domain: 1 }, { unique: true });

module.exports = mongoose.model('Topic', topicSchema);
