const router = require('express').Router();
const User = require('../models/User');
const { issueToken, requireAuth } = require('../middleware/auth');

// ── POST /api/auth/signup ────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name: name.trim(), email, passwordHash });

    issueToken(res, user._id);
    res.status(201).json({ user });
  } catch (err) {
    console.error('signup error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/signin ────────────────────────────────────────────────────
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await user.checkPassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    issueToken(res, user._id);
    res.json({ user });
  } catch (err) {
    console.error('signin error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ ok: true });
});

// ── GET /api/auth/me — check session ────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.passwordHash;
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
