const express = require('express');
const router = express.Router();
const { getProfile, getAttendance, getFees, getNotifications, createComplaint, getMyComplaints } = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/profile', protect, getProfile);
router.get('/attendance', protect, getAttendance);
router.get('/fees', protect, getFees);
router.get('/notifications', protect, getNotifications);
router.post('/complaints', protect, createComplaint);
router.get('/complaints', protect, getMyComplaints);

module.exports = router;
