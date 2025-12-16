require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

// Models
const Book = require('./models/Book');
const User = require('./models/User');

const app = express();

// Deployment Settings
const PORT = process.env.PORT || 3000;
const dbURI = process.env.DATABASE_URL;

// Database Connection
mongoose.connect(dbURI)
    .then(() => console.log("✅ Connected to MongoDB Atlas Cloud"))
    .catch(err => console.log("❌ DB Connection Error:", err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false
}));

// --- Routes ---

app.get('/', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    let query = {};
    if (req.query.search) {
        query.title = { $regex: req.query.search, $options: 'i' };
    }
    const books = await Book.find(query).sort({ createdAt: -1 });
    res.render('index', { books, username: req.session.username, searchQuery: req.query.search || '' });
});

app.get('/login', (req, res) => res.render('login'));
app.get('/signup', (req, res) => res.render('signup'));

app.post('/signup', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({ username: req.body.username, password: hashedPassword });
        await user.save();
        res.redirect('/login');
    } catch (err) {
        if (err.code === 11000) return res.send("Username already exists. <a href='/signup'>Try again</a>");
        res.send("Signup failed.");
    }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username });
    if (user && await bcrypt.compare(req.body.password, user.password)) {
        req.session.userId = user._id;
        req.session.username = user.username;
        res.redirect('/');
    } else {
        res.send("Invalid credentials. <a href='/login'>Try again</a>");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/add', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('add-book');
});

app.post('/add', async (req, res) => {
    try {
        await new Book(req.body).save();
        res.redirect('/');
    } catch (err) {
        res.send("Error adding book.");
    }
});

app.post('/delete/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    await Book.findByIdAndDelete(req.params.id);
    res.redirect('/');
});

app.listen(PORT, () => console.log(`🚀 Site running on port ${PORT}`));
module.exports = app;
