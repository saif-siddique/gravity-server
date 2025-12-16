const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { initializeSocket } = require('./socket/socketHandler');

dotenv.config();

const instance = await mongoose.connect(`${process.env.MONGO_URI}/hostler-database`)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

if (!instance) res.status(400).json({message : "Mongodb connection failed"});

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN,
    credentials: true
  }
});

// Initialize socket handlers
initializeSocket(io);

// Middleware
app.use(cors({
  origin: process.env.SOCKET_CORS_ORIGIN, // Frontend URL
  credentials: true // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Database Connection


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

const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
});
