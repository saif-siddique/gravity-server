const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  target: { 
    type: String, 
    enum: ['all', 'specific'], 
    required: true,
    index: true
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
notificationSchema.index({ target: 1, createdAt: -1 });
notificationSchema.index({ student: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });

// Compound index for checking read status
notificationSchema.index({ student: 1, readBy: 1 });

// Index for expiration
notificationSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0, // TTL index - auto-delete expired notifications
  sparse: true 
});

// Virtual to check if notification is read by specific student
notificationSchema.virtual('isRead').get(function() {
  // This will be set dynamically when querying
  return false;
});

// Method to mark as read by a student
notificationSchema.methods.markAsRead = function(studentId) {
  if (!this.readBy.includes(studentId)) {
    this.readBy.push(studentId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get unread notifications for a student
notificationSchema.statics.getUnreadForStudent = function(studentId) {
  return this.find({
    $or: [
      { target: 'all' },
      { target: 'specific', student: studentId }
    ],
    readBy: { $ne: studentId },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ priority: -1, createdAt: -1 });
};

module.exports = mongoose.model('Notification', notificationSchema);
