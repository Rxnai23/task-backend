require('dotenv').config();

const express = require('express');
const app = express();

const cors = require('cors');

app.use(cors());

app.use(express.json());
const PORT = process.env.PORT || 3000;

require('./db');

const Task = require('./models/Task');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const SECRET_KEY = process.env.JWT_SECRET;

// Middleware ฟังก์ชันสำหรับตรวจ Token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "คุณไม่มีสิทธิ์เข้าถึง! (กรุณาล็อกอิน)" });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Token ไม่ถูกต้อง หรือหมดอายุ!" });

        req.user = decoded; 
        next();
    });
};

app.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "ระบบฐานข้อมูลขัดข้อง", error: err.message });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const newTask = new Task({
      title: req.body.title,
      priority: req.body.priority
    });
    await newTask.save();
    res.status(201).json({ message: "บันทึกสำเร็จ!", task: newTask });
  } catch (err) {
    res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", error: err.message });
  }
});

// ข้อ 13: UPDATE (PUT) : แก้ไขสถานะงาน (เสร็จ/ไม่เสร็จ)
app.put('/tasks/:id', async (req, res) => {
  try {
    // ค้นหางานด้วย _id
    const task = await Task.findById(req.params.id);
    // หากหา _id ไม่เจอ ให้ตอบกลับว่าไม่พบข้อมูล
    if (!task) {
      return res.status(404).json({ message: "ไม่พบงานหมายเลขนี้" });
    }
    // สลับค่า Boolean (ถ้า true ให้เป็น false / ถ้า false ให้เป็น true)
    task.completed = !task.completed;
    // บันทึกทับลง Database
    await task.save();
    res.json({ message: "อัปเดตสถานะสำเร็จ", task: task });
  } catch (err) {
    res.status(500).json({ message: "ID ผิดรูปแบบ หรือระบบขัดข้อง" });
  }
});

// ข้อ 14: DELETE (ลบงาน)
app.delete('/tasks/:id', verifyToken, async (req, res) => {
  try {
    // คำสั่งเดียวจบ : ค้นหาด้วย id แล้วลบทิ้งทันที
    const deletedTask = await Task.findByIdAndDelete(req.params.id);
    if (!deletedTask) {
      return res.status(404).json({ message: "ไม่พบงานหมายเลขนี้" });
    }
    res.json({ message: "ลบงานออกจากระบบเรียบร้อยแล้ว" });
  } catch (err) {
    res.status(500).json({ message: "ID ผิดรูปแบบ หรือระบบขัดข้อง" });
  }
});

// API สมัครสมาชิก (เข้ารหัสรหัสผ่าน)
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            username: username,
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ message: "สมัครสมาชิกสำเร็จ!" });
    } catch (err) {
        res.status(400).json({ message: "สมัครไม่สำเร็จ (Username อาจจะซ้ำ)", error: err.message });
    }
});

// API ล็อกอิน แจก Token
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username: username });
        if (!user) return res.status(404).json({ message: "ไม่พบชื่อผู้ใช้นี้" });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง!" });

        const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ message: "ล็อกอินสำเร็จ!", token: token });
    } catch (err) {
        res.status(500).json({ message: "ระบบขัดข้อง" });
    }
});

app.listen(PORT, () => {
    console.log(`Server กำลังรันอยู่ที่พอร์ต ${PORT}`);
});

