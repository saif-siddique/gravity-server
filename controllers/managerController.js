const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const Complaint = require('../models/Complaint');
const Fee = require('../models/Fee');
const bcrypt = require('bcryptjs');

// @desc    Register a new student
// @route   POST /api/manager/students
// @access  Private/Admin
const registerStudent = async (req, res) => {
  const { 
    name, email, password, cnic, phone, address, 
    guardianName, guardianPhone, roomType 
  } = req.body;
  
  try {
    // Validate required fields
    if (!name || !email || !password || !cnic || !phone || !address || 
        !guardianName || !guardianPhone || !roomType) {
      return res.status(400).json({ 
        message: 'Please provide all required fields' 
      });
    }
    
    console.log(`📝 Registering new student: ${email}`);
    
    // 1. Create User
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const user = await User.create({
      name, email, password, role: 'student'
    });
    
    // 2. Allocate Room
    const room = await Room.findOne({ 
      type: roomType, 
      status: { $ne: 'full' } 
    });
    
    if (!room) {
      // Cleanup: delete created user if room allocation fails
      await User.findByIdAndDelete(user._id);
      return res.status(400).json({ 
        message: 'No available room of this type' 
      });
    }
    
    // 3. Create Student Profile
    const student = await Student.create({
      user: user._id,
      cnic, phone, address,
      guardian: { name: guardianName, phone: guardianPhone },
      room: room._id
    });
    
    // 4. Update Room Occupancy
    room.occupants.push(student._id);
    if (room.occupants.length >= room.capacity) {
      room.status = 'full';
    }
    await room.save();
    
    console.log(`✅ Student registered successfully: ${student._id}`);
    res.status(201).json(student);
  } catch (error) {
    console.error('❌ Error in registerStudent:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all students
// @route   GET /api/manager/students
// @access  Private/Admin
const getStudents = async (req, res) => {
  try {
    console.log('📚 Fetching all students...');
    const students = await Student.find().populate('user', 'name email').populate('room', 'number type');
    console.log(`✅ Found ${students.length} students`);
    res.json(students);
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get student by ID
// @route   GET /api/manager/students/:id
// @access  Private/Admin
const getStudentById = async (req, res) => {
  try {
    console.log(`📖 Fetching student with ID: ${req.params.id}`);
    const student = await Student.findById(req.params.id)
      .populate('user', 'name email role')
      .populate('room', 'number type capacity status');
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    console.log(`✅ Found student: ${student.user?.name}`);
    res.json(student);
  } catch (error) {
    console.error('❌ Error fetching student:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update student
// @route   PUT /api/manager/students/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
  try {
    const { name, email, cnic, phone, address, guardianName, guardianPhone } = req.body;
    console.log(`✏️ Updating student with ID: ${req.params.id}`);
    
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Update User info if provided
    if (name || email) {
      const user = await User.findById(student.user);
      if (user) {
        if (name) user.name = name;
        if (email) {
          // Check if email is already taken by another user
          const emailExists = await User.findOne({ 
            email, 
            _id: { $ne: student.user } 
          });
          if (emailExists) {
            return res.status(400).json({ message: 'Email already in use' });
          }
          user.email = email;
        }
        await user.save();
      }
    }

    // Update Student info
    if (cnic) student.cnic = cnic;
    if (phone) student.phone = phone;
    if (address) student.address = address;
    if (guardianName) student.guardian.name = guardianName;
    if (guardianPhone) student.guardian.phone = guardianPhone;

    await student.save();
    
    // Populate and return updated student
    const updatedStudent = await Student.findById(student._id)
      .populate('user', 'name email')
      .populate('room', 'number type');
    
    console.log(`✅ Student updated successfully`);
    res.json(updatedStudent);
  } catch (error) {
    console.error('❌ Error updating student:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete student
// @route   DELETE /api/manager/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
  try {
    console.log(`🗑️ Deleting student with ID: ${req.params.id}`);
    
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Remove student from room occupants
    if (student.room) {
      const room = await Room.findById(student.room);
      if (room) {
        room.occupants = room.occupants.filter(
          occupant => occupant.toString() !== student._id.toString()
        );
        if (room.status === 'full' && room.occupants.length < room.capacity) {
          room.status = 'available';
        }
        await room.save();
      }
    }
    
    // Delete all related records (cascade delete)
    await Attendance.deleteMany({ student: student._id });
    await Fee.deleteMany({ student: student._id });
    await Complaint.deleteMany({ student: student._id });
    await Notification.deleteMany({ student: student._id });

    // Delete associated user account
    await User.findByIdAndDelete(student.user);
    
    // Delete student record
    await Student.findByIdAndDelete(req.params.id);
    
    console.log(`✅ Student and all related records deleted successfully`);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting student:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a room
// @route   POST /api/manager/rooms
// @access  Private/Admin
const createRoom = async (req, res) => {
  try {
    const { number, type, capacity, price, floor, status } = req.body;
    
    // Validate required fields
    if (!number || !type || !capacity || price === undefined) {
      return res.status(400).json({ 
        message: 'Please provide all required fields (number, type, capacity, price)' 
      });
    }
    
    // Check for duplicate room number
    const existingRoom = await Room.findOne({ number });
    if (existingRoom) {
      return res.status(400).json({ message: 'Room number already exists' });
    }
    
    const room = await Room.create({ number, type, capacity, price, floor, status });
    console.log(`✅ Room created: ${room.number}`);
    res.status(201).json(room);
  } catch (error) {
    console.error('❌ Error creating room:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all rooms
// @route   GET /api/manager/rooms
// @access  Private/Admin
const getRooms = async (req, res) => {
  try {
    console.log('🏠 Fetching all rooms...');
    const rooms = await Room.find()
      .populate({
        path: 'occupants',
        populate: {
          path: 'user',
          select: 'name email'
        },
        select: 'cnic phone user'
      })
      .sort({ number: 1 });
    
    console.log(`✅ Found ${rooms.length} rooms`);
    res.json(rooms);
  } catch (error) {
    console.error('❌ Error fetching rooms:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get attendance by date
// @route   GET /api/manager/attendance/:date
// @access  Private/Admin
const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    console.log('📅 Fetching attendance for date:', date);
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const attendance = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('student', '_id');
    
    console.log(`✅ Found ${attendance.length} attendance records for ${date}`);
    res.json(attendance);
  } catch (error) {
    console.error('❌ Error fetching attendance:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark or update attendance
// @route   POST /api/manager/attendance
// @access  Private/Admin
const markAttendance = async (req, res) => {
  const { date, records } = req.body; // records: [{ studentId, status }]

  try {
    console.log(`📝 Marking/updating attendance for ${date} with ${records.length} records`);
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.find({
      date: { $gte: targetDate, $lte: endOfDay }
    });
    
    if (existingAttendance.length > 0) {
      // UPDATE existing attendance
      console.log('🔄 Updating existing attendance...');
      
      const updatePromises = records.map(async (record) => {
        const existing = existingAttendance.find(
          a => a.student.toString() === record.studentId
        );
        
        if (existing) {
          // Update existing record
          existing.status = record.status;
          existing.markedBy = req.user._id;
          return existing.save();
        } else {
          // Create new record for student not in original attendance
          return Attendance.create({
            student: record.studentId,
            date: targetDate,
            status: record.status,
            markedBy: req.user._id
          });
        }
      });
      
      await Promise.all(updatePromises);
      console.log('✅ Attendance updated successfully');
      res.json({ message: 'Attendance updated successfully', isUpdate: true });
    } else {
      // CREATE new attendance
      console.log('✨ Creating new attendance records...');
      
      const attendanceRecords = records.map(record => ({
        student: record.studentId,
        date: targetDate,
        status: record.status,
        markedBy: req.user._id
      }));

      await Attendance.insertMany(attendanceRecords);
      console.log('✅ Attendance marked successfully');
      res.status(201).json({ message: 'Attendance marked successfully', isUpdate: false });
    }
  } catch (error) {
    console.error('❌ Error marking attendance:', error);
    res.status(500).json({ message: error.message });
  }
};



// @desc    Send notification
// @route   POST /api/manager/notifications
// @access  Private/Admin
const sendNotification = async (req, res) => {
  try {
    const { title, message, target, student } = req.body;
    
    // Validate required fields
    if (!title || !message || !target) {
      return res.status(400).json({ 
        message: 'Title, message, and target are required' 
      });
    }
    
    // Validate target values
    if (!['all', 'specific'].includes(target)) {
      return res.status(400).json({ 
        message: 'Target must be "all" or "specific"' 
      });
    }
    
    // If specific, student ID is required
    if (target === 'specific' && !student) {
      return res.status(400).json({ 
        message: 'Student ID required for specific notifications' 
      });
    }

    const notification = await Notification.create({
      title,
      message,
      target,
      student: student || null
    });
    
    // 🔥 REAL-TIME: Emit socket event for instant notification delivery
    if (global.io) {
      if (target === 'all') {
        // Send to all students
        global.io.to('students').emit('new-notification', {
          id: notification._id,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          createdAt: notification.createdAt
        });
        console.log(`🔔 Real-time notification sent to all students`);
      } else if (target === 'specific' && student) {
        // Send to specific student
        global.io.to(`user-${student}`).emit('new-notification', {
          id: notification._id,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          createdAt: notification.createdAt
        });
        console.log(`🔔 Real-time notification sent to student ${student}`);
      }
    }
    
    console.log(`✅ Notification sent: ${target}`);
    res.status(201).json(notification);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all complaints
// @route   GET /api/manager/complaints
// @access  Private/Admin
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find().populate({
      path: 'student',
      populate: { path: 'user', select: 'name email' }
    }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update complaint status
// @route   PUT /api/manager/complaints/:id
// @access  Private/Admin
const updateComplaintStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/manager/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const totalRooms = await Room.countDocuments();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceToday = await Attendance.countDocuments({
      date: { $gte: today },
      status: 'present'
    });

    const pendingComplaints = await Complaint.countDocuments({ status: 'pending' });

    res.json({
      totalStudents,
      totalRooms,
      attendanceToday,
      pendingComplaints
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { 
  registerStudent, getStudents, getStudentById, updateStudent, deleteStudent,
  createRoom, getRooms, 
  markAttendance, getAttendanceByDate, sendNotification,
  getAllComplaints, updateComplaintStatus,
  getDashboardStats
};
