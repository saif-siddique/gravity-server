const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate Access Token (Short-lived: 15 minutes)
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
};

// Generate Refresh Token (Crypto-based, not JWT)
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Hash Token (for storage)
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Extract Device Info from Request
const extractDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Simple fingerprint (can be enhanced with more data)
  const fingerprint = crypto
    .createHash('md5')
    .update(userAgent + ip)
    .digest('hex');
  
  return {
    userAgent,
    ip,
    fingerprint
  };
};

// ============================================
// AUTH CONTROLLERS
// ============================================

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    const userExists = await User.findOne({ email });
    
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student'
    });
    
    if (user) {
      // Generate tokens
      const accessToken = generateAccessToken(user._id, user.role);
      const refreshToken = generateRefreshToken();
      
      // Store refresh token in database
      await RefreshToken.create({
        userId: user._id,
        token: hashToken(refreshToken),
        deviceInfo: extractDeviceInfo(req),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
      
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
      // Send refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      console.log(`✅ User registered: ${user.email}`);
      
      res.status(201).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        accessToken
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('❌ Error in registerUser:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    const user = await User.findOne({ email });
    
    if (user && (await user.matchPassword(password))) {
      // Generate tokens
      const accessToken = generateAccessToken(user._id, user.role);
      const refreshToken = generateRefreshToken();
      
      // Store refresh token in database
      await RefreshToken.create({
        userId: user._id,
        token: hashToken(refreshToken),
        deviceInfo: extractDeviceInfo(req),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
      
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
      // Send refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      console.log(`✅ User logged in: ${user.email}`);
      
      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        accessToken
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('❌ Error in loginUser:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (but requires refresh token cookie)
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }
    
    // Find token in database
    const hashedToken = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({
      token: hashedToken,
      isRevoked: false
    }).populate('userId');
    
    if (!storedToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    
    // Check expiry
    if (storedToken.isExpired()) {
      await storedToken.revoke('expired');
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    
    // TOKEN ROTATION: Generate new refresh token
    const newRefreshToken = generateRefreshToken();
    
    // Create new refresh token in DB
    await RefreshToken.create({
      userId: storedToken.userId._id,
      token: hashToken(newRefreshToken),
      deviceInfo: extractDeviceInfo(req),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    // Revoke old refresh token (rotation)
    await storedToken.revoke('rotated');
    
    // Generate new access token
    const newAccessToken = generateAccessToken(storedToken.userId._id, storedToken.userId.role);
    
    res.clearCookie("refreshToken", {
      httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
    })
    // Send new refresh token as cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    console.log(`🔄 Token refreshed for user: ${storedToken.userId.email}`);
    
    res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('❌ Error in refreshAccessToken:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user (revoke refresh token)
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (refreshToken) {
      const hashedToken = hashToken(refreshToken);
      const storedToken = await RefreshToken.findOne({ token: hashedToken });
      
      if (storedToken) {
        await storedToken.revoke('logout');
      }
    }
    
    // Clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
    });
    
    console.log(`👋 User logged out: ${req.user?.email || 'unknown'}`);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Error in logoutUser:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
const logoutAllDevices = async (req, res) => {
  try {
    // Revoke all refresh tokens for this user
    await RefreshToken.updateMany(
      { userId: req.user._id, isRevoked: false },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'logout_all'
      }
    );
    
    // Clear current cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax'
    });
    
    console.log(`🚪 User logged out from all devices: ${req.user.email}`);
    
    res.json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    console.error('❌ Error in logoutAllDevices:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('❌ Error in getMe:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active sessions
// @route   GET /api/auth/sessions
// @access  Private
const getActiveSessions = async (req, res) => {
  try {
    const sessions = await RefreshToken.find({
      userId: req.user._id,
      isRevoked: false
    }).select('deviceInfo createdAt lastUsedAt').sort({ createdAt: -1 });
    
    res.json(sessions);
  } catch (error) {
    console.error('❌ Error in getActiveSessions:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Revoke specific session
// @route   DELETE /api/auth/sessions/:tokenId
// @access  Private
const revokeSession = async (req, res) => {
  try {
    const token = await RefreshToken.findOne({
      _id: req.params.tokenId,
      userId: req.user._id
    });
    
    if (!token) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    await token.revoke('manual_revoke');
    
    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('❌ Error in revokeSession:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  getMe,
  getActiveSessions,
  revokeSession
};
