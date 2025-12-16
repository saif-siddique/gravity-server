const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true // Index for faster lookups
  },
  cnic: { 
    type: String, 
    required: true,
    trim: true,
    match: [/^[0-9]{13}$/, 'CNIC must be 13 digits']
  },
  phone: { 
    type: String, 
    required: true,
    match: [/^[0-9]{10,15}$/, 'Please enter a valid phone number']
  },
  address: { 
    type: String, 
    required: true 
  },
  guardian: {
    name: { type: String, required: true },
    phone: { type: String, required: true }
  },
  room: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Room',
    index: true // Index for room-based queries
  },
  isActive: {
    type: Boolean,
    default: true
  },
  enrollmentDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for search optimization
studentSchema.index({ cnic: 1 }, { unique: true });
studentSchema.index({ phone: 1 });
studentSchema.index({ isActive: 1 });
studentSchema.index({ createdAt: -1 }); // For sorting by newest

// Compound index for room + status queries
studentSchema.index({ room: 1, isActive: 1 });

module.exports = mongoose.model('Student', studentSchema);
