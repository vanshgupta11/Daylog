const router = require('express').Router();
const Tracker = require('../models/Tracker');
const { requireAuth } = require('../middleware/auth');

// All data routes require authentication
router.use(requireAuth);

// ── GET /api/data — load tracker state for current user ──────────────────────
router.get('/', async (req, res) => {
  try {
    const doc = await Tracker.findOne({ user: req.userId });
    if (!doc) return res.json({ exists: false });
    res.json({ exists: true, json: doc.json, updated: doc.updated });
  } catch (err) {
    console.error('data GET error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/data — save (full replace) tracker state ───────────────────────
router.put('/', async (req, res) => {
  try {
    const { json, updated } = req.body;
    if (!json) return res.status(400).json({ error: 'json is required' });

    const doc = await Tracker.findOneAndUpdate(
      { user: req.userId },
      { json, updated: updated || Date.now() },
      { upsert: true, new: true },
    );
    res.json({ ok: true, updated: doc.updated });
  } catch (err) {
    console.error('data PUT error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
