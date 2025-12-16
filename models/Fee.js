const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true,
    index: true
  },
  month: { 
    type: Number, 
    required: true,
    min: 1,
    max: 12
  },
  year: { 
    type: Number, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  roomRent: {
    type: Number,
    required: true,
    min: 0
  },
  messFee: {
    type: Number,
    default: 5000
  },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'overdue', 'partial'], 
    default: 'pending',
    index: true
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paidDate: {
    type: Date
  },
  dueDate: { 
    type: Date,
    required: true 
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'online', 'cheque']
  },
  transactionId: {
    type: String
  },
  remarks: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for student's fee history (most common query)
feeSchema.index({ student: 1, year: -1, month: -1 });

// Compound index for unique fee per month/year per student
feeSchema.index({ student: 1, month: 1, year: 1 }, { unique: true });

// Index for finding overdue fees
feeSchema.index({ status: 1, dueDate: 1 });

// Virtual for remaining balance
feeSchema.virtual('balance').get(function() {
  return this.amount - this.paidAmount;
});

// Virtual for payment status
feeSchema.virtual('isOverdue').get(function() {
  return this.status !== 'paid' && new Date() > this.dueDate;
});

// Pre-save hook to auto-calculate amount and update status
feeSchema.pre('save', async function() {
  // Auto-calculate total amount from roomRent + messFee
  if (this.isModified('roomRent') || this.isModified('messFee')) {
    this.amount = this.roomRent + this.messFee;
  }
  
  // Auto-update status based on payment
  if (this.paidAmount >= this.amount) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  } else if (new Date() > this.dueDate) {
    this.status = 'overdue';
  }
});

// Static method to get pending fees for a student
feeSchema.statics.getPendingFees = function(studentId) {
  return this.find({
    student: studentId,
    status: { $in: ['pending', 'partial', 'overdue'] }
  }).sort({ year: -1, month: -1 });
};

module.exports = mongoose.model('Fee', feeSchema);
