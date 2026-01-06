const Video = require('../models/Video');
const Domain = require('../models/Domain');
const Topic = require('../models/Topic');
const AccessRule = require('../models/AccessRule');
const AuditLog = require('../models/AuditLog');
const { normalizeIp } = require('../utils/ipUtils');
const fs = require('fs');
const path = require('path');

exports.getAccessibleContent = async (req, res) => {
    const userId = req.user._id;
    const now = new Date();

    // Find all active access rules for this user
    const rules = await AccessRule.find({
        user: userId,
        expiresAt: { $gt: now }
    });

    if (rules.length === 0) {
        return res.json({ domains: [], topics: [], videos: [] });
    }

    // Extract filters from rules
    const domainIds = rules.map(r => r.domain).filter(id => id);
    const topicIds = rules.map(r => r.topic).filter(id => id);

    // If a rule has a domain but no topic, it means access to all topics in that domain
    // This logic can be refined based on specific needs

    // Construct video query based on rules
    const orConditions = rules.map(rule => {
        const condition = {};
        if (rule.domain) condition.domain = rule.domain;
        if (rule.topic) condition.topic = rule.topic;
        if (rule.year) condition.year = rule.year;
        if (rule.month) condition.month = rule.month;
        if (rule.day) condition.day = rule.day;
        return condition;
    });

    const videos = await Video.find({ $or: orConditions })
        .populate('domain topic')
        .sort('-createdAt');

    // Also get the hierarchy for the UI
    const accessibleDomains = await Domain.find({ _id: { $in: videos.map(v => v.domain._id) } });
    const accessibleTopics = await Topic.find({ _id: { $in: videos.map(v => v.topic._id) } });

    res.json({
        domains: accessibleDomains,
        topics: accessibleTopics,
        videos: videos
    });
};

exports.streamVideo = async (req, res) => {
    const videoId = req.params.videoId;
    const userId = req.user._id;
    const now = new Date();

    const video = await Video.findById(videoId);
    if (!video) {
        return res.status(404).json({ message: 'Video not found' });
    }

    // Check access rules
    const rules = await AccessRule.find({
        user: userId,
        expiresAt: { $gt: now }
    });

    const hasAccess = rules.some(rule => {
        const matchDomain = !rule.domain || rule.domain.toString() === video.domain.toString();
        const matchTopic = !rule.topic || rule.topic.toString() === video.topic.toString();
        const matchYear = !rule.year || rule.year === video.year;
        const matchMonth = !rule.month || rule.month === video.month;
        const matchDay = !rule.day || rule.day === video.day;

        return matchDomain && matchTopic && matchYear && matchMonth && matchDay;
    });

    if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied or expired' });
    }

    // Log the access
    try {
        await AuditLog.create({
            action: 'WATCH_VIDEO',
            user: userId,
            ip: normalizeIp(req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress),
            details: {
                videoId: video._id,
                title: video.title
            }
        });
    } catch (err) {
        console.error('Audit Log Error:', err);
    }

    // If it's a Vercel Blob URL, redirect to it
    if (video.videoUrl && video.videoUrl.startsWith('http')) {
        return res.redirect(video.videoUrl);
    }

    // Fallback for old local files
    const videoPath = path.join(__dirname, '../uploads', video.videoUrl || video.filename);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ message: 'Video file not found on server' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
};
