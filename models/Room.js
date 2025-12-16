const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  number: { 
    type: String, 
    required: true
  },
  type: { 
    type: String, 
    enum: ['standard', 'deluxe', 'suite'], 
    required: true,
    index: true // Index for filtering by type
  },
  capacity: { 
    type: Number, 
    required: true,
    min: 1,
    max: 4
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  status: { 
    type: String, 
    enum: ['available', 'occupied', 'full', 'maintenance'], 
    default: 'available',
    index: true // Index for filtering by status
  },
  floor: {
    type: Number,
    min: 0,
    max: 10
  },
  occupants: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student' 
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for search and filtering
roomSchema.index({ number: 1 }, { unique: true });
roomSchema.index({ type: 1, status: 1 }); // Compound index for common queries
roomSchema.index({ floor: 1 });

// Virtual for occupancy percentage
roomSchema.virtual('occupancyRate').get(function() {
  if (this.capacity === 0) return 0;
  if (!this.occupants || !Array.isArray(this.occupants)) return 0;
  return Math.round((this.occupants.length / this.capacity) * 100);
});

// Virtual for available beds
roomSchema.virtual('availableBeds').get(function() {
  if (!this.occupants || !Array.isArray(this.occupants)) return this.capacity;
  return this.capacity - this.occupants.length;
});

// Pre-save hook to auto-update status based on occupants
roomSchema.pre('save', async function() {
  const occupantCount = this.occupants?.length || 0;
  
  if (this.status === 'maintenance') {
    // Don't auto-update if in maintenance
    return;
  }
  
  if (occupantCount >= this.capacity) {
    this.status = 'full';
  } else if (occupantCount === 0) {
    this.status = 'available';
  } else {
    this.status = 'occupied';
  }
});

// Static method to find available rooms by type
roomSchema.statics.findAvailableByType = function(type) {
  return this.find({
    type,
    status: { $in: ['available', 'occupied'] },
    $expr: { $lt: [{ $size: '$occupants' }, '$capacity'] }
  });
};

module.exports = mongoose.model('Room', roomSchema);
