const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getAccessibleContent, streamVideo } = require('../controllers/userController');

router.use(protect);

router.get('/content', getAccessibleContent);
router.get('/stream/:videoId', streamVideo);

module.exports = router;
