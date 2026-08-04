const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const quizRoutes = require('./routes/quiz');
const trackRoutes = require('./routes/track');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');

const app = express();
app.set('trust proxy', true);

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve the static frontend
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// SPA-ish fallback for known frontend routes (not /api/*)
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LearnStream server running at http://localhost:${PORT}`);
});
