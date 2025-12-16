const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  category: {
    type: String,
    enum: ['maintenance', 'food', 'facilities', 'roommate', 'billing', 'security', 'other'],
    default: 'other',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true
  },
  status: { 
    type: String, 
    enum: ['pending', 'in-progress', 'resolved', 'rejected'], 
    default: 'pending',
    index: true
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  adminNotes: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for common queries
complaintSchema.index({ student: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ category: 1, status: 1 });
complaintSchema.index({ priority: 1, status: 1, createdAt: -1 });

// Virtual for resolution time
complaintSchema.virtual('resolutionTime').get(function() {
  if (this.resolvedAt && this.createdAt) {
    const diff = this.resolvedAt - this.createdAt;
    const hours = Math.round(diff / (1000 * 60 * 60));
    return hours;
  }
  return null;
});

// Virtual check if complaint is pending too long (>72 hours)
complaintSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'pending') return false;
  const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  return hoursSinceCreation > 72;
});

// Pre-save hook to auto-set resolvedAt
complaintSchema.pre('save', async function() {
  if (this.isModified('status') && (this.status === 'resolved' || this.status === 'rejected')) {
    if (!this.resolvedAt) {
      this.resolvedAt = new Date();
    }
  }
});

// Static method to get pending complaints
complaintSchema.statics.getPending = function() {
  return this.find({ status: 'pending' })
    .populate({
      path: 'student',
      populate: { path: 'user room' }
    })
    .sort({ priority: -1, createdAt: 1 });
};

module.exports = mongoose.model('Complaint', complaintSchema);
