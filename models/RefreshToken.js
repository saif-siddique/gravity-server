const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    index: true
  },
  deviceInfo: {
    userAgent: String,
    ip: String,
    fingerprint: String
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  revokedAt: Date,
  revokedReason: String
});

// Compound index for efficient queries
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ token: 1 }, { unique: true });

// TTL index - auto-delete expired tokens after 30 days
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
refreshTokenSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt;
};

refreshTokenSchema.methods.isValid = function() {
  return !this.isExpired() && !this.isRevoked;
};

refreshTokenSchema.methods.revoke = async function(reason) {
  this.isRevoked = true;
  this.revokedAt = Date.now();
  this.revokedReason = reason;
  await this.save();
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
