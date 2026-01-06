const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Video title is required'],
        trim: true
    },
    videoUrl: {
        type: String,
        required: [true, 'Video URL is required']
    },
    filename: {
        type: String,
        // Optional for backward compatibility with local files
    },
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain',
        required: true
    },
    topic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    month: {
        type: Number,
        required: true
    },
    day: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    mimetype: String,
    size: Number
}, {
    timestamps: true
});

module.exports = mongoose.model('Video', videoSchema);
