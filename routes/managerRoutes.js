const express = require('express');
const { registerStudent, getStudents, getStudentById, updateStudent, deleteStudent, createRoom, getRooms, markAttendance, getAttendanceByDate, sendNotification, getAllComplaints, updateComplaintStatus, getDashboardStats } = require('../controllers/managerController');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/students', protect, admin, registerStudent);
router.get('/students', protect, admin, getStudents);
router.get('/students/:id', protect, admin, getStudentById);
router.put('/students/:id', protect, admin, updateStudent);
router.delete('/students/:id', protect, admin, deleteStudent);
router.post('/rooms', protect, admin, createRoom);
router.get('/rooms', protect, admin, getRooms);
router.post('/attendance', protect, admin, markAttendance);
router.get('/attendance/:date', protect, admin, getAttendanceByDate);
router.post('/notifications', protect, admin, sendNotification);
router.get('/complaints', protect, admin, getAllComplaints);
router.put('/complaints/:id', protect, admin, updateComplaintStatus);
router.get('/stats', protect, admin, getDashboardStats);

module.exports = router;
