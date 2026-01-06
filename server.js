const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const User = require('./models/User');

// Load env vars
dotenv.config();

const app = express();

// Trust proxy for correct IP capturing
app.set('trust proxy', true);

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: false, // For video streaming
}));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/user', require('./routes/userRoutes'));

// Root path for API check
app.get('/', (req, res) => {
    res.send('Asterisk Ace API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

// Seed Admin User
const seedAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.warn('Admin credentials missing in env, skipping seed.');
            return;
        }

        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            await User.create({
                email: adminEmail,
                password: adminPassword,
                role: 'admin',
                isFirstLogin: false
            });
            console.log('Admin user seeded successfully');
        }
    } catch (error) {
        console.error('Error seeding admin:', error.message);
    }
};

// Initialize DB and Start Server
const init = async () => {
    try {
        await connectDB();
        await seedAdmin();
    } catch (err) {
        console.error('Initialization failed:', err.message);
    }
};

init();

// Export app for Vercel
module.exports = app;

// Listen only if not on Vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
