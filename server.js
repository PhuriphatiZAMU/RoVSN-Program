// server.js - ฉบับแก้ไขสำหรับ Render
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // [เพิ่ม] เรียกใช้ path

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// [เพิ่ม] ให้ Express เข้าถึงไฟล์ต่างๆ ใน Folder โปรเจกต์ได้ (เช่น html, css, js, รูปภาพ)
app.use(express.static(__dirname));

// Database Connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rov_sn_tournament_2026';

mongoose.connect(MONGO_URI)
    .then(() => console.log(`✅ MongoDB Connected`))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const ScheduleSchema = new mongoose.Schema({
    teams: [String],
    potA: [String],
    potB: [String],
    schedule: Array,
    createdAt: { type: Date, default: Date.now }
});

const Schedule = mongoose.model('Schedule', ScheduleSchema, 'schedules');

// --- API Routes ---

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running', db: 'rov_sn_tournament_2026' });
});

// Create Schedule
app.post('/api/schedules', async (req, res) => {
    try {
        const newSchedule = new Schedule(req.body);
        const saved = await newSchedule.save();
        console.log('📝 New schedule saved:', saved._id);
        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Schedules
app.get('/api/schedules', async (req, res) => {
    try {
        const schedules = await Schedule.find().sort({ createdAt: -1 });
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// [แก้ไข] Route หลัก ('/') ให้ส่งไฟล์ index.html แทนข้อความ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});