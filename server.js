require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initializeDB } = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'cert-auth-secret-2024',
  resave: false, saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 },
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));

app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initializeDB().then(() => {
  app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║      🔐 CertAuth System 서버 시작      ║');
    console.log(`║   http://localhost:${PORT}               ║`);
    console.log('╚════════════════════════════════════════╝\n');
    console.log('  관리자: admin@certauth.local / admin1234');
    console.log('  사용자: kim@certauth.local   / user1234\n');
  });
});
