const mongoose = require('mongoose');

/**
 * Stores the full Daylog state JSON blob for a user.
 * We store it as a raw JSON string (same format daylog.js already serialises)
 * plus an `updated` timestamp for conflict resolution.
 */
const trackerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,   // one document per user
  },
  json: {
    type: String,   // serialised daylog state
    required: true,
    default: '{}',
  },
  updated: {
    type: Number,   // Date.now() millis — same field daylog.js uses
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Tracker', trackerSchema);
