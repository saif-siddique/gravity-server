const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Check if user exists
    const existing = await User.findOne({ email: 'ahmad@gmail.com' });
    if (existing) {
      console.log('User already exists');
      process.exit(0);
    }

    // Create Admin with the email you're using
    const admin = await User.create({
      name: 'Ahmad',
      email: 'ahmad@gmail.com',
      password: 'admin123',
      role: 'admin'
    });
    
    console.log('✅ Admin created successfully!');
    console.log('Email: ahmad@gmail.com');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createAdmin();
