const User = require('../models/User');
const Domain = require('../models/Domain');
const Topic = require('../models/Topic');
const Video = require('../models/Video');
const AccessRule = require('../models/AccessRule');
const AuditLog = require('../models/AuditLog');
const { sendEmail, getWelcomeTemplate, getNotificationTemplate } = require('../utils/emailService');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');
const { put, del } = require('@vercel/blob');
const { handleUpload } = require('@vercel/blob/client');

// --- User Management ---

exports.getUsers = async (req, res) => {
    const users = await User.find({ role: 'user' }).sort('-createdAt');
    res.json(users);
};

exports.createUser = async (req, res) => {
    const { email } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const generatedPassword = nanoid(10);
    const user = await User.create({
        email,
        password: generatedPassword,
        role: 'user'
    });

    try {
        const loginUrl = `${process.env.APP_BASE_URL}/login`;
        await sendEmail({
            to: email,
            subject: 'Your Asterisk Ace Account - Credentials Inside',
            html: getWelcomeTemplate(email, generatedPassword, loginUrl)
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: 'User created but email failed to send' });
    }
};

exports.updateUser = async (req, res) => {
    const { status } = req.body;
    const user = await User.findById(req.params.id);

    if (user) {
        user.status = status || user.status;
        await user.save();

        await sendEmail({
            to: user.email,
            subject: 'Account Update - Asterisk Ace',
            html: getNotificationTemplate('Account Updated', `Your account status has been updated to: ${user.status}`)
        });

        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

exports.deleteUser = async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        const email = user.email;
        await User.deleteOne({ _id: user._id });

        // Also delete access rules
        await AccessRule.deleteMany({ user: user._id });

        await sendEmail({
            to: email,
            subject: 'Account Deleted - Asterisk Ace',
            html: getNotificationTemplate('Account Deleted', 'Your account has been deleted by the administrator.')
        });

        res.json({ message: 'User removed' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// --- Domain/Topic Management ---

exports.createDomain = async (req, res) => {
    const { name, description } = req.body;
    const domain = await Domain.create({ name, description });
    res.status(201).json(domain);
};

exports.getDomains = async (req, res) => {
    const domains = await Domain.find().sort('name');
    res.json(domains);
};

exports.createTopic = async (req, res) => {
    const { name, domainId, description } = req.body;
    const topic = await Topic.create({ name, domain: domainId, description });
    res.status(201).json(topic);
};

exports.getTopicsByDomain = async (req, res) => {
    const topics = await Topic.find({ domain: req.params.domainId }).sort('name');
    res.json(topics);
};

// --- Video Management ---

exports.createVideo = async (req, res) => {
    const { title, domain, topic, year, month, day, description, videoUrl, mimetype, size } = req.body;

    if (!videoUrl) {
        return res.status(400).json({ message: 'Video URL is required' });
    }

    const video = await Video.create({
        title,
        videoUrl, // Use videoUrl instead of filename
        domain,
        topic,
        year,
        month,
        day,
        description,
        mimetype,
        size
    });

    res.status(201).json(video);
};

exports.getVideos = async (req, res) => {
    const videos = await Video.find().populate('domain topic').sort('-createdAt');
    res.json(videos);
};

exports.deleteVideo = async (req, res) => {
    const video = await Video.findById(req.params.id);
    if (video) {
        // Delete from Vercel Blob if it's a blob URL
        if (video.videoUrl && video.videoUrl.includes('public.blob.vercel-storage.com')) {
            try {
                await del(video.videoUrl);
            } catch (error) {
                console.error('Failed to delete blob:', error);
            }
        }

        await Video.deleteOne({ _id: video._id });
        res.json({ message: 'Video removed' });
    } else {
        res.status(404).json({ message: 'Video not found' });
    }
};

// --- Access Rule Management ---

exports.createAccessRule = async (req, res) => {
    const { userId, domain, topic, year, month, day, durationDays } = req.body;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

    const rule = await AccessRule.create({
        user: userId,
        domain,
        topic,
        year,
        month,
        day,
        expiresAt
    });

    res.status(201).json(rule);
};

exports.getUserAccessRules = async (req, res) => {
    const rules = await AccessRule.find({ user: req.params.userId }).populate('domain topic');
    res.json(rules);
};

exports.deleteAccessRule = async (req, res) => {
    await AccessRule.deleteOne({ _id: req.params.id });
    res.json({ message: 'Access rule removed' });
};

// --- Logs & Streaming ---

exports.getLogs = async (req, res) => {
    const logs = await AuditLog.find().populate('user', 'email').sort('-timestamp').limit(100);
    res.json(logs);
};

exports.getAdminStream = async (req, res) => {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // If it's a Vercel Blob URL, redirect or stream it
    if (video.videoUrl && video.videoUrl.startsWith('http')) {
        return res.redirect(video.videoUrl);
    }

    // Fallback for old local files (won't work on Vercel prod)
    const videoPath = path.join(__dirname, '../uploads', video.videoUrl || video.filename);
    if (!fs.existsSync(videoPath)) return res.status(404).json({ message: 'File not found' });

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        });
        file.pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' });
        fs.createReadStream(videoPath).pipe(res);
    }
};

// Vercel Blob Upload Handler for Client-Side Uploads
exports.handleBlobUpload = async (req, res) => {
    try {
        const jsonResponse = await handleUpload({
            body: req.body,
            request: req,
            onBeforeGenerateToken: async (pathname) => {
                // You can add logic here to check if the user is an admin
                return {
                    allowedContentTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
                    tokenPayload: JSON.stringify({
                        userId: req.user._id,
                    }),
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                console.log('blob upload completed', blob, tokenPayload);
            },
        });

        return res.status(200).json(jsonResponse);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
};
