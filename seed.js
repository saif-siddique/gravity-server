const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Student = require('./models/Student');
const Room = require('./models/Room');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Clear existing data
    await User.deleteMany({});
    await Student.deleteMany({});
    await Room.deleteMany({});
    console.log('Cleared existing data');

    // Create Admin
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@gravity.com',
      password: 'admin123',
      role: 'admin'
    });
    console.log('✅ Admin created - Email: admin@gravity.com, Password: admin123');

    // Create Room
    const room = await Room.create({
      number: '101',
      type: 'standard',
      capacity: 2,
      price: 5000,
      status: 'available'
    });
    console.log('✅ Room 101 created');

    // Create Student User
    const studentUser = await User.create({
      name: 'John Doe',
      email: 'student@gravity.com',
      password: 'student123',
      role: 'student'
    });

    // Create Student Profile
    const student = await Student.create({
      user: studentUser._id,
      cnic: '12345-6789012-3',
      phone: '0300-1234567',
      address: '123 Main Street, City',
      guardian: {
        name: 'Jane Doe',
        phone: '0300-7654321'
      },
      room: room._id
    });
    console.log('✅ Student created - Email: student@gravity.com, Password: student123');

    // Update room occupants
    room.occupants.push(student._id);
    await room.save();

    console.log('\n🎉 Seed data created successfully!');
    console.log('\nLogin Credentials:');
    console.log('Admin: admin@gravity.com / admin123');
    console.log('Student: student@gravity.com / student123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
