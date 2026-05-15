require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initializeDB } = require('../utils/db');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// WASM MIME 타입
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
  },
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cert-auth-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
    sameSite: 'lax',
  },
}));

app.use('/api/auth',  require('../routes/auth'));
app.use('/api/user',  require('../routes/user'));
app.use('/api/admin', require('../routes/admin'));
app.use('/api/face',  require('../routes/face'));

app.get('/{*path}', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);

// 서버리스 콜드 스타트 대응 — DB 한 번만 초기화
let initialized = false;
module.exports = async (req, res) => {
  if (!initialized) {
    await initializeDB();
    initialized = true;
  }
  return app(req, res);
};
