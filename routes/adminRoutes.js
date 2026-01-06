const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, admin } = require('../middlewares/authMiddleware');
const {
    getUsers, createUser, updateUser, deleteUser,
    getDomains, createDomain,
    getTopicsByDomain, createTopic,
    getVideos, createVideo, deleteVideo,
    getUserAccessRules, createAccessRule, deleteAccessRule,
    getLogs, getAdminStream
} = require('../controllers/adminController');

// Multer Config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /mp4|mkv|avi|mov/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Only video files are allowed!"));
    }
});

// All routes here require admin privileges
router.use(protect);
router.use(admin);

// Users
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Content
router.get('/domains', getDomains);
router.post('/domains', createDomain);
router.get('/topics/:domainId', getTopicsByDomain);
router.post('/topics', createTopic);

// Videos
router.get('/videos', getVideos);
router.post('/videos', upload.single('video'), createVideo);
router.delete('/videos/:id', deleteVideo);

// Access Rules
router.get('/access-rules/:userId', getUserAccessRules);
router.post('/access-rules', createAccessRule);
router.delete('/access-rules/:id', deleteAccessRule);

// Logs
router.get('/logs', getLogs);

// Admin Streaming for Preview
router.get('/stream/:id', getAdminStream);

module.exports = router;
