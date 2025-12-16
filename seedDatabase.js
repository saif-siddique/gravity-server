const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Student = require('./models/Student');
const Room = require('./models/Room');
const Attendance = require('./models/Attendance');
const Fee = require('./models/Fee');
const Notification = require('./models/Notification');
const Complaint = require('./models/Complaint');

// Sample student names
const studentNames = [
  'Ali Hassan', 'Ahmed Raza', 'Bilal Khan', 'Danish Ali', 'Ehsan Ahmed',
  'Faisal Mahmood', 'Haris Mehmood', 'Imran Malik', 'Junaid Akram', 'Kamran Shahid',
  'Luqman Hakim', 'Muhammad Usman', 'Nabeel Ahmad', 'Omar Farooq', 'Qasim Ali',
  'Rizwan Ahmed', 'Saad Bin Tahir', 'Talha Anjum', 'Umar Farooq', 'Wahab Riaz',
  'Yasir Shah', 'Zain Abbas', 'Asad Shafiq', 'Babar Azam', 'Fahad Mustafa',
  'Hassan Ali', 'Imran Ashraf', 'Junaid Khan', 'Kamran Akmal', 'Muneeb Butt',
  'Nasir Jamshed', 'Omer Akmal', 'Rahul Khan', 'Shahid Afridi', 'Taimoor Khan',
  'Usama Mir', 'Waqar Younis', 'Yasir Nawaz', 'Zubair Khan', 'Aamir Jamal',
  'Basit Ali', 'Dawood Khan', 'Farhan Saeed', 'Gohar Ali', 'Hashim Amla',
  'Iftikhar Ahmed', 'Jawad Ahmad', 'Khalid Mahmood', 'Mohsin Khan', 'Noman Ali'
];

// CNICs and phone numbers
const generateCNIC = (index) => `${35202 + index}-${1234567 + index}-${index % 9 + 1}`;
const generatePhone = (index) => `+92300${1000000 + index}`;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ DB Connection Error:', error);
    process.exit(1);
  }
};

const clearDatabase = async () => {
  console.log('🗑️  Clearing existing data...');
  await User.deleteMany({ role: { $ne: 'admin' } }); // Keep admin accounts
  await Student.deleteMany({});
  await Room.deleteMany({});
  await Attendance.deleteMany({});
  await Fee.deleteMany({});
  await Notification.deleteMany({});
  await Complaint.deleteMany({});
  console.log('✅ Database cleared');
};

const createRooms = async () => {
  console.log('🏠 Creating rooms...');
  const rooms = [];
  
  // Create 30 rooms across different types and floors
  for (let i = 1; i <= 30; i++) {
    const floor = Math.ceil(i / 10);
    const roomNum = `${floor}${String(i % 10 || 10).padStart(2, '0')}`;
    
    let type, capacity, price;
    if (i <= 15) {
      type = 'standard';
      capacity = 3;
      price = 15000;
    } else if (i <= 25) {
      type = 'deluxe';
      capacity = 2;
      price = 20000;
    } else {
      type = 'suite';
      capacity = 1;
      price = 25000;
    }
    
    rooms.push({
      number: roomNum,
      type,
      capacity,
      price,
      floor,
      status: 'available',
      occupants: []
    });
  }
  
  const createdRooms = await Room.insertMany(rooms);
  console.log(`✅ Created ${createdRooms.length} rooms`);
  return createdRooms;
};

const createStudents = async (rooms) => {
  console.log('👨‍🎓 Creating students...');
  const students = [];
  const users = [];
  
  for (let i = 0; i < 50; i++) {
    // Create user account for each student (password will be hashed by User model's pre-save hook)
    const user = await User.create({
      name: studentNames[i],
      email: `student${i + 1}@hostel.com`,
      password: 'student123', // Plain text - will be hashed automatically
      role: 'student'
    });
    
    users.push(user);
    
    // Assign room (some students won't have rooms yet)
    let assignedRoom = null;
    if (i < 40) { // 40 students get rooms, 10 are waiting
      const availableRooms = rooms.filter(r => r.occupants.length < r.capacity);
      if (availableRooms.length > 0) {
        assignedRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
      }
    }
    
    const student = {
      user: user._id,
      cnic: generateCNIC(i + 1),
      phone: generatePhone(i + 1),
      address: `House ${i + 1}, Street ${Math.floor(i / 5) + 1}, Sector ${String.fromCharCode(65 + (i % 10))}, Islamabad`,
      guardian: {
        name: `Father of ${studentNames[i]}`,
        phone: `+92321${2000000 + i}`
      },
      room: assignedRoom ? assignedRoom._id : null,
      isActive: i < 48, // 2 students are inactive
      enrollmentDate: new Date(2024, Math.floor(i / 10), (i % 28) + 1)
    };
    
    students.push(student);
    
    // Update room occupants
    if (assignedRoom) {
      assignedRoom.occupants.push(null); // Placeholder, will update after student creation
    }
  }
  
  const createdStudents = await Student.insertMany(students);
  
  // Update room occupants with actual student IDs
  for (let i = 0; i < createdStudents.length; i++) {
    if (createdStudents[i].room) {
      await Room.findByIdAndUpdate(
        createdStudents[i].room,
        { $push: { occupants: createdStudents[i]._id } }
      );
    }
  }
  
  console.log(`✅ Created ${createdStudents.length} students`);
  return createdStudents;
};

const createAttendance = async (students) => {
  console.log('📅 Creating attendance records...');
  const records = [];
  const today = new Date();
  
  // Create 90 days of attendance history
  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    for (const student of students) {
      if (!student.isActive) continue;
      
      // 90% chance of present, 8% absent, 2% leave
      const rand = Math.random();
      let status;
      if (rand < 0.90) status = 'present';
      else if (rand < 0.98) status = 'absent';
      else status = 'leave';
      
      records.push({
        student: student._id,
        date,
        status
      });
    }
  }
  
  const createdRecords = await Attendance.insertMany(records);
  console.log(`✅ Created ${createdRecords.length} attendance records`);
  return createdRecords;
};

const createFees = async (students) => {
  console.log('💰 Creating fee records...');
  const fees = [];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Create fees for past 6 months
  for (const student of students) {
    if (!student.isActive) continue;
    
    const room = await Room.findById(student.room);
    const roomRent = room ? room.price : 15000;
    const messFee = 5000;
    
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      let month = currentMonth - monthOffset;
      let year = currentYear;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      const dueDate = new Date(year, month - 1, 10);
      const isPaid = monthOffset > 0 || Math.random() < 0.7; // 70% of current month paid
      
      fees.push({
        student: student._id,
        month,
        year,
        amount: roomRent + messFee,
        roomRent,
        messFee,
        status: isPaid ? 'paid' : (new Date() > dueDate ? 'overdue' : 'pending'),
        paidAmount: isPaid ? (roomRent + messFee) : 0,
        paidDate: isPaid ? new Date(year, month - 1, Math.floor(Math.random() * 28) + 1) : null,
        dueDate
      });
    }
  }
  
  const createdFees = await Fee.insertMany(fees);
  console.log(`✅ Created ${createdFees.length} fee records`);
  return createdFees;
};

const createNotifications = async (students) => {
  console.log('📢 Creating notifications...');
  const notifications = [];
  
  const notificationData = [
    { title: 'Welcome to Hostel', message: 'Welcome to our hostel management system!', target: 'all', priority: 'normal' },
    { title: 'Fee Payment Reminder', message: 'Please pay your monthly fees before the due date.', target: 'all', priority: 'high' },
    { title: 'Maintenance Notice', message: 'Water supply will be interrupted tomorrow 10 AM - 2 PM.', target: 'all', priority: 'urgent' },
    { title: 'Room Inspection', message: 'Room inspections will be conducted next week.', target: 'all', priority: 'normal' },
    { title: 'Mess Menu Update', message: 'New mess menu available from next month.', target: 'all', priority: 'low' }
  ];
  
  // General notifications
  for (const notif of notificationData) {
    notifications.push({
      ...notif,
      readBy: students.slice(0, Math.floor(Math.random() * students.length / 2)).map(s => s._id)
    });
  }
  
  // Specific notifications for random students
  for (let i = 0; i < 10; i++) {
    const randomStudent = students[Math.floor(Math.random() * students.length)];
    notifications.push({
      title: 'Personal Notice',
      message: 'Please visit the admin office regarding your room allocation.',
      target: 'specific',
      student: randomStudent._id,
      priority: 'normal',
      readBy: Math.random() < 0.5 ? [randomStudent._id] : []
    });
  }
  
  const createdNotifications = await Notification.insertMany(notifications);
  console.log(`✅ Created ${createdNotifications.length} notifications`);
  return createdNotifications;
};

const createComplaints = async (students) => {
  console.log('🔧 Creating complaints...');
  const complaints = [];
  
  const complaintData = [
    { title: 'AC not working', description: 'The air conditioner in my room is not cooling properly.', category: 'maintenance', priority: 'high' },
    { title: 'Mess food quality', description: 'Food quality has decreased recently.', category: 'food', priority: 'medium' },
    { title: 'Noisy roommate', description: 'My roommate plays loud music late at night.', category: 'roommate', priority: 'medium' },
    { title: 'Billing error', description: 'I was charged extra this month.', category: 'billing', priority: 'high' },
    { title: 'Wi-Fi not working', description: 'Internet connection is very slow in my room.', category: 'facilities', priority: 'medium' },
  ];
  
  for (let i = 0; i < 15; i++) {
    const randomStudent = students[Math.floor(Math.random() * students.length)];
    const randomComplaint = complaintData[i % complaintData.length];
    const daysAgo = Math.floor(Math.random() * 30);
    
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    
    // Some complaints are resolved
    const isResolved = daysAgo > 7 && Math.random() < 0.6;
    
    complaints.push({
      student: randomStudent._id,
      ...randomComplaint,
      status: isResolved ? 'resolved' : (daysAgo > 14 && Math.random() < 0.2 ? 'rejected' : 'pending'),
      resolvedAt: isResolved ? new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
      createdAt
    });
  }
  
  const createdComplaints = await Complaint.insertMany(complaints);
  console.log(`✅ Created ${createdComplaints.length} complaints`);
  return createdComplaints;
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seed...\n');
    
    await connectDB();
    await clearDatabase();
    
    const rooms = await createRooms();
    const students = await createStudents(rooms);
    await createAttendance(students);
    await createFees(students);
    await createNotifications(students);
    await createComplaints(students);
    
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Rooms: ${await Room.countDocuments()}`);
    console.log(`   - Students: ${await Student.countDocuments()}`);
    console.log(`   - Attendance Records: ${await Attendance.countDocuments()}`);
    console.log(`   - Fee Records: ${await Fee.countDocuments()}`);
    console.log(`   - Notifications: ${await Notification.countDocuments()}`);
    console.log(`   - Complaints: ${await Complaint.countDocuments()}`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('   Admin: ahmad@gmail.com / admin123');
    console.log('   Student: student1@hostel.com / student123');
    console.log('   (Or any student1-50@hostel.com with password student123)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Error:', error);
    process.exit(1);
  }
};

seedDatabase();
