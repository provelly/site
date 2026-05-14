const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { Users, Certificates } = require('../utils/db');

// 내 정보
router.get('/me', requireAuth, (req, res) => {
  const { password, ...safe } = req.user;
  res.json({ success: true, user: safe });
});

// 내 인증서 목록
router.get('/me/certificates', requireAuth, (req, res) => {
  const certs = Certificates.findByUserId(req.user.id).map(c => ({
    id: c.id, fingerprint: c.fingerprint, serialNumber: c.serialNumber,
    status: c.status, notBefore: c.notBefore, notAfter: c.notAfter,
    issuedAt: c.issuedAt, revokedAt: c.revokedAt, revokeReason: c.revokeReason,
  }));
  res.json({ success: true, certificates: certs });
});

// 특정 인증서 PEM 다운로드
router.get('/me/certificates/:id/download', requireAuth, (req, res) => {
  const cert = Certificates.findById(req.params.id);
  if (!cert || cert.userId !== req.user.id)
    return res.status(404).json({ success: false, message: '인증서를 찾을 수 없습니다.' });
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', `attachment; filename="cert_${req.user.name}_${cert.serialNumber}.pem"`);
  res.send(`${cert.certificate}\n${cert.privateKey}`);
});

// 최신 활성 인증서 다운로드 (회원가입 직후 사용)
router.get('/me/certificates/latest/download', requireAuth, (req, res) => {
  const cert = Certificates.findActiveByUserId(req.user.id);
  if (!cert) return res.status(404).json({ success: false, message: '활성 인증서가 없습니다.' });
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', `attachment; filename="cert_${req.user.name}_${cert.serialNumber}.pem"`);
  res.send(`${cert.certificate}\n${cert.privateKey}`);
});

module.exports = router;
