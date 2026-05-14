const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Users, Certificates } = require('../utils/db');
const { parseCertificate, isCertificateValid, generateCertificate } = require('../utils/certUtils');

// ─── 이메일 중복 확인 ─────────────────────────────
router.post('/check-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: '이메일을 입력하세요.' });
  const exists = !!Users.findByEmail(email);
  res.json({ success: true, available: !exists, message: exists ? '이미 사용 중인 이메일입니다.' : '사용 가능한 이메일입니다.' });
});

// ─── 아이디 중복 확인 ─────────────────────────────
router.post('/check-username', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: '아이디를 입력하세요.' });
  const exists = Users.findAll().some(u => u.username === username);
  res.json({ success: true, available: !exists, message: exists ? '이미 사용 중인 아이디입니다.' : '사용 가능한 아이디입니다.' });
});

// ─── Step 2 → 3: 인증서 미리 생성 후 세션에 저장 ──
router.post('/register/preview-cert', async (req, res) => {
  const { name, age, email, username, password, department, organization } = req.body;

  if (!name || !age || !email || !username || !password)
    return res.status(400).json({ success: false, message: '필수 항목을 모두 입력하세요.' });

  if (Users.findByEmail(email))
    return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
  if (Users.findAll().some(u => u.username === username))
    return res.status(409).json({ success: false, message: '이미 사용 중인 아이디입니다.' });

  const certData = generateCertificate({
    name, email,
    organization: organization || 'CertAuth System',
    department: department || '미지정',
  });

  // 세션에 pending 데이터 저장
  req.session.pendingUser = {
    name, age: parseInt(age), email, username, password,
    department: department || '미지정',
    organization: organization || 'CertAuth System',
    certData: {
      certificate: certData.certificate,
      privateKey:  certData.privateKey,
      publicKey:   certData.publicKey,
      fingerprint: certData.fingerprint,
      serialNumber: certData.serialNumber,
      notBefore:   certData.notBefore.toISOString(),
      notAfter:    certData.notAfter.toISOString(),
    },
  };

  // 세션을 명시적으로 저장한 뒤 응답
  req.session.save(err => {
    if (err) {
      console.error('session save error:', err);
      return res.status(500).json({ success: false, message: '세션 저장 실패' });
    }
    res.json({
      success: true,
      certPreview: {
        serialNumber: certData.serialNumber,
        fingerprint:  certData.fingerprint,
        notBefore:    certData.notBefore.toISOString(),
        notAfter:     certData.notAfter.toISOString(),
        subject: { name, email },
      },
    });
  });
});

// ─── Step 3 → 4: 최종 확정 ────────────────────────
router.post('/register/confirm', async (req, res) => {
  const pending = req.session.pendingUser;
  if (!pending)
    return res.status(400).json({ success: false, message: '회원가입 세션이 만료되었습니다. 처음부터 다시 시도해주세요.' });

  if (Users.findByEmail(pending.email))
    return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
  if (Users.findAll().some(u => u.username === pending.username))
    return res.status(409).json({ success: false, message: '이미 사용 중인 아이디입니다.' });

  const hashed = await bcrypt.hash(pending.password, 10);
  const userId  = uuidv4();

  const user = Users.create({
    id: userId,
    name: pending.name,
    age:  pending.age,
    email: pending.email,
    username: pending.username,
    password: hashed,
    role: 'user',
    department:   pending.department,
    organization: pending.organization,
    createdAt: new Date().toISOString(),
    isActive: true,
  });

  Certificates.create({
    id: uuidv4(),
    userId,
    userName:  pending.name,
    userEmail: pending.email,
    ...pending.certData,
    status:    'active',
    issuedAt:  new Date().toISOString(),
    revokedAt:    null,
    revokeReason: null,
  });

  // pendingUser 삭제 후 자동 로그인
  delete req.session.pendingUser;
  req.session.userId      = userId;
  req.session.loginMethod = 'password';

  req.session.save(err => {
    if (err) return res.status(500).json({ success: false, message: '세션 저장 실패' });
    const { password: _, ...safeUser } = user;
    const cert = Certificates.findActiveByUserId(userId);
    res.status(201).json({
      success: true,
      user: safeUser,
      certificate: {
        id:           cert.id,
        serialNumber: cert.serialNumber,
        fingerprint:  cert.fingerprint,
        notBefore:    cert.notBefore,
        notAfter:     cert.notAfter,
      },
    });
  });
});

// ─── 비밀번호 로그인 ───────────────────────────────
router.post('/login/password', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력하세요.' });

  const user = Users.findAll().find(u => u.username === username || u.email === username);
  if (!user)   return res.status(401).json({ success: false, message: '존재하지 않는 계정입니다.' });
  if (!user.isActive) return res.status(403).json({ success: false, message: '비활성화된 계정입니다.' });
  if (!user.password) return res.status(401).json({ success: false, message: '비밀번호가 설정되지 않은 계정입니다.' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });

  req.session.userId      = user.id;
  req.session.loginMethod = 'password';
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// ─── 인증서 로그인 ─────────────────────────────────
router.post('/login/certificate', (req, res) => {
  const { certificate } = req.body;
  if (!certificate) return res.status(400).json({ success: false, message: '인증서를 제공해주세요.' });

  const parsed = parseCertificate(certificate);
  if (!parsed.valid)    return res.status(400).json({ success: false, message: '유효하지 않은 인증서 형식입니다.' });
  if (parsed.isExpired) return res.status(401).json({ success: false, message: '만료된 인증서입니다.' });

  const certRecord = Certificates.findByFingerprint(parsed.fingerprint);
  if (!certRecord)                     return res.status(401).json({ success: false, message: '등록되지 않은 인증서입니다.' });
  if (certRecord.status === 'revoked') return res.status(401).json({ success: false, message: '폐기된 인증서입니다.' });
  if (!isCertificateValid(certRecord.certificate)) return res.status(401).json({ success: false, message: '만료된 인증서입니다.' });

  const user = Users.findById(certRecord.userId);
  if (!user || !user.isActive) return res.status(403).json({ success: false, message: '비활성화된 계정입니다.' });

  req.session.userId      = user.id;
  req.session.loginMethod = 'certificate';
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser, loginMethod: 'certificate' });
});

// ─── 로그아웃 ──────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ─── 세션 확인 ─────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false });
  const user = Users.findById(req.session.userId);
  if (!user) return res.status(401).json({ success: false });
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser, loginMethod: req.session.loginMethod });
});

module.exports = router;
