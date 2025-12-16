const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  getActiveSessions,
  revokeSession
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshAccessToken);
router.post('/logout', protect, logoutUser);
router.post('/logout-all', protect, logoutAllDevices);
router.get('/me', protect, getMe);
router.get('/sessions', protect, getActiveSessions);
router.delete('/sessions/:tokenId', protect, revokeSession);

module.exports = router;
