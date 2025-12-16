const jwt = require('jsonwebtoken');

// Socket.IO Authentication Middleware 
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to socket
    socket.userId = decoded.id; 
    socket.userRole = decoded.role;
    
    console.log(`✅ Socket authenticated: User ${decoded.id} (${decoded.role})`);
    next();
  } catch (error) {
    console.error('❌ Socket authentication failed:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
};

// Initialize Socket.IO
const initializeSocket = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

    // Join role-based room
    const roleRoom = socket.userRole === 'admin' ? 'admins' : 'students';
    socket.join(roleRoom);
    console.log(`📍 User ${socket.userId} joined room: ${roleRoom}`);

    // Join user-specific room
    const userRoom = `user-${socket.userId}`;
    socket.join(userRoom);
    console.log(`📍 User ${socket.userId} joined personal room: ${userRoom}`);

    // Handle mark notification as read
    socket.on('mark-notification-read', async (data) => {
      try {
        console.log(`📖 User ${socket.userId} marked notification ${data.notificationId} as read`);
        
        // Emit confirmation back to user
        socket.emit('notification-read-success', {
          notificationId: data.notificationId
        });
      } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        socket.emit('notification-read-error', {
          message: error.message
        });
      }
    });

    // Handle request for unread count
    socket.on('get-unread-count', async () => {
      try {
        // This will be handled by fetching from DB
        // For now, just acknowledge
        console.log(`📊 User ${socket.userId} requested unread count`);
      } catch (error) {
        console.error('❌ Error getting unread count:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (Reason: ${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Store io instance globally for use in controllers
  global.io = io;
  
  console.log('🚀 Socket.IO initialized successfully');
};

module.exports = { initializeSocket };
