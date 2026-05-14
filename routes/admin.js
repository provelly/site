const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const { Users, Certificates } = require('../utils/db');
const { generateCertificate } = require('../utils/certUtils');

router.get('/users', requireAdmin, (req, res) => {
  const users = Users.findAll().map(({ password, ...u }) => {
    const certs = Certificates.findByUserId(u.id);
    const active = certs.find(c => c.status === 'active');
    return { ...u, certCount: certs.length, activeCert: active ? { id: active.id, status: active.status, notAfter: active.notAfter } : null };
  });
  res.json({ success: true, users });
});

router.post('/users', requireAdmin, async (req, res) => {
  const { name, age, email, username, password, department, organization, role } = req.body;
  if (!name || !age || !email || !username || !password)
    return res.status(400).json({ success: false, message: '이름, 나이, 이메일, 아이디, 비밀번호는 필수입니다.' });
  if (Users.findByEmail(email))
    return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
  if (Users.findAll().some(u => u.username === username))
    return res.status(409).json({ success: false, message: '이미 사용 중인 아이디입니다.' });

  const hashed = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const user = Users.create({ id: userId, name, age: parseInt(age), email, username, password: hashed, role: role || 'user', department: department || '미지정', organization: organization || 'CertAuth System', createdAt: new Date().toISOString(), isActive: true });
  const certData = generateCertificate({ name, email, organization: organization || 'CertAuth System', department: department || '미지정' });
  const cert = Certificates.create({ id: uuidv4(), userId, userName: name, userEmail: email, certificate: certData.certificate, privateKey: certData.privateKey, publicKey: certData.publicKey, fingerprint: certData.fingerprint, serialNumber: certData.serialNumber, notBefore: certData.notBefore.toISOString(), notAfter: certData.notAfter.toISOString(), status: 'active', issuedAt: new Date().toISOString(), revokedAt: null, revokeReason: null });
  const { password: _, ...safe } = user;
  res.status(201).json({ success: true, user: safe, certificate: { id: cert.id, fingerprint: cert.fingerprint } });
});

router.patch('/users/:id/toggle', requireAdmin, (req, res) => {
  const user = Users.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
  const updated = Users.update(req.params.id, { isActive: !user.isActive });
  res.json({ success: true, isActive: updated.isActive });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ success: false, message: '자신의 계정은 삭제할 수 없습니다.' });
  res.json({ success: Users.delete(req.params.id) });
});

router.get('/certificates', requireAdmin, (req, res) => {
  const certs = Certificates.findAll().map(({ certificate, privateKey, publicKey, ...c }) => c);
  res.json({ success: true, certificates: certs });
});

router.post('/certificates/issue/:userId', requireAdmin, (req, res) => {
  const user = Users.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
  const existing = Certificates.findActiveByUserId(user.id);
  if (existing) Certificates.update(existing.id, { status: 'superseded', revokedAt: new Date().toISOString(), revokeReason: '새 인증서 발급으로 대체됨' });
  const certData = generateCertificate({ name: user.name, email: user.email, organization: user.organization, department: user.department });
  const cert = Certificates.create({ id: uuidv4(), userId: user.id, userName: user.name, userEmail: user.email, certificate: certData.certificate, privateKey: certData.privateKey, publicKey: certData.publicKey, fingerprint: certData.fingerprint, serialNumber: certData.serialNumber, notBefore: certData.notBefore.toISOString(), notAfter: certData.notAfter.toISOString(), status: 'active', issuedAt: new Date().toISOString(), revokedAt: null, revokeReason: null });
  res.status(201).json({ success: true, certificate: { id: cert.id, fingerprint: cert.fingerprint, serialNumber: cert.serialNumber } });
});

router.post('/certificates/:id/revoke', requireAdmin, (req, res) => {
  const cert = Certificates.findById(req.params.id);
  if (!cert) return res.status(404).json({ success: false, message: '인증서를 찾을 수 없습니다.' });
  if (cert.status === 'revoked') return res.status(400).json({ success: false, message: '이미 폐기된 인증서입니다.' });
  Certificates.update(req.params.id, { status: 'revoked', revokedAt: new Date().toISOString(), revokeReason: req.body.reason || '관리자에 의해 폐기됨' });
  res.json({ success: true });
});

router.get('/certificates/:id/download', requireAdmin, (req, res) => {
  const cert = Certificates.findById(req.params.id);
  if (!cert) return res.status(404).json({ success: false });
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', `attachment; filename="cert_${cert.userName}_${cert.serialNumber}.pem"`);
  res.send(`${cert.certificate}\n${cert.privateKey}`);
});

router.get('/certificates/:id/detail', requireAdmin, (req, res) => {
  const cert = Certificates.findById(req.params.id);
  if (!cert) return res.status(404).json({ success: false });
  res.json({ success: true, certificate: cert });
});

router.get('/stats', requireAdmin, (req, res) => {
  const users = Users.findAll();
  const certs = Certificates.findAll();
  const now = new Date(), soon = new Date(now.getTime() + 30 * 86400000);
  res.json({ success: true, stats: {
    totalUsers: users.length, activeUsers: users.filter(u => u.isActive).length,
    inactiveUsers: users.filter(u => !u.isActive).length,
    totalCerts: certs.length, activeCerts: certs.filter(c => c.status === 'active').length,
    revokedCerts: certs.filter(c => c.status === 'revoked').length,
    expiringSoon: certs.filter(c => c.status === 'active' && new Date(c.notAfter) <= soon && new Date(c.notAfter) > now).length,
  }});
});

module.exports = router;
