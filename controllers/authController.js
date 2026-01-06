const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OTP = require('../models/OTP');
const AuditLog = require('../models/AuditLog');
const { normalizeIp } = require('../utils/ipUtils');
const { sendEmail, getOTPTemplate } = require('../utils/emailService');
const { nanoid } = require('nanoid');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email }).select('+password');

        if (user && (await user.comparePassword(password, user.password))) {
            if (user.status === 'disabled') {
                return res.status(403).json({ message: 'Account is disabled' });
            }

            user.lastLogin = Date.now();
            await user.save();

            // Log login activity
            try {
                await AuditLog.create({
                    action: 'LOGIN',
                    user: user._id,
                    ip: normalizeIp(req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress),
                    details: { email: user.email }
                });
            } catch (err) {
                console.error('Audit Log Error:', err);
            }

            res.json({
                _id: user._id,
                email: user.email,
                role: user.role,
                isFirstLogin: user.isFirstLogin,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            email: user.email,
            role: user.role,
            status: user.status,
            isFirstLogin: user.isFirstLogin
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (user && (await user.comparePassword(currentPassword, user.password))) {
        user.password = newPassword;
        user.isFirstLogin = false;
        await user.save();
        res.json({ message: 'Password updated successfully' });
    } else {
        res.status(401).json({ message: 'Invalid current password' });
    }
};

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: 'User with this email does not exist' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await OTP.create({ email, otp, expiresAt });

    try {
        await sendEmail({
            to: email,
            subject: 'Password Reset OTP - Asterisk Ace',
            html: getOTPTemplate(otp)
        });
        res.json({ message: 'OTP sent to email' });
    } catch (error) {
        res.status(500).json({ message: 'Email could not be sent' });
    }
};

// @desc    Reset password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    const validOtp = await OTP.findOne({ email, otp });

    if (!validOtp) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    await OTP.deleteOne({ _id: validOtp._id });

    res.json({ message: 'Password reset successful' });
};
