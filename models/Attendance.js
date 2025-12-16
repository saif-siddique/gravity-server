const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true,
    index: true
  },
  date: { 
    type: Date, 
    required: true,
    index: true
  },
  status: { 
    type: String, 
    enum: ['present', 'absent', 'leave'], 
    required: true,
    index: true
  },
  markedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate entries and optimize queries
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

// Index for date range queries (common for reports)
attendanceSchema.index({ date: -1, status: 1 });

// Index for student's attendance history
attendanceSchema.index({ student: 1, date: -1 });

// Static method to get attendance for a date range
attendanceSchema.statics.getByDateRange = function(studentId, startDate, endDate) {
  return this.find({
    student: studentId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });
};

// Static method to calculate attendance percentage
attendanceSchema.statics.calculatePercentage = async function(studentId, startDate, endDate) {
  const records = await this.find({
    student: studentId,
    date: { $gte: startDate, $lte: endDate }
  });
  
  if (records.length === 0) return 0;
  
  const presentCount = records.filter(r => r.status === 'present').length;
  return Math.round((presentCount / records.length) * 100);
};

module.exports = mongoose.model('Attendance', attendanceSchema);
