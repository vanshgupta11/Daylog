const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRouter = require('./routes/auth');
const dataRouter = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/daylog';

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);

// ── Serve built React client ─────────────────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// ── Serve the original vanilla tracker (public folder) ──────────────────────
app.use('/tracker', express.static(path.join(__dirname, '..', 'public')));

// ── React SPA catch-all ──────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── Connect & start ──────────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
