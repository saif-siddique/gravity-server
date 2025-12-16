const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { initializeSocket } = require('./socket/socketHandler');

dotenv.config();

const app = express();
const server = http.createServer(app);

// --- CORRECTION 1: Centralized CORS Configuration ---
// Define allowed origins based on environment to avoid typos
const ALLOWED_ORIGIN = process.env.SOCKET_CORS_ORIGIN || "https://gravityhostel.vercel.app";

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    credentials: true
  }
});

// Initialize socket handlers
initializeSocket(io);

// --- CORRECTION 2: Consistent Express CORS ---
app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// app.options("*", cors()); // Usually not needed if app.use(cors) is set up correctly above, but harmless if kept.

app.use(express.json());
app.use(cookieParser());

// Routes
const authRoutes = require('./routes/authRoutes');
const managerRoutes = require('./routes/managerRoutes');
const studentRoutes = require('./routes/studentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/student', studentRoutes);

app.get('/', (req, res) => {
  res.send('Gravity Hostel Management API is running');
});

// --- CORRECTION 3: Proper DB Connection & Server Start ---
// Wrap connection in an async function to avoid top-level await issues
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
    
    // Only listen if DB connects successfully
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.IO ready for connections from: ${ALLOWED_ORIGIN}`);
    });

  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1); // Exit process with failure
  }
};

startServer();