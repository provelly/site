const express = require('express');
const router = express.Router();
const { Users, Certificates } = require('../utils/db');
const { requireAuth } = require('../middleware/auth');

// ─── 얼굴 descriptor 등록 (회원가입 or 마이페이지) ──
router.post('/register', requireAuth, (req, res) => {
  const { descriptor } = req.body;
  if (!descriptor || !Array.isArray(descriptor))
    return res.status(400).json({ success: false, message: 'descriptor 배열이 필요합니다.' });
  if (descriptor.length !== 128)
    return res.status(400).json({ success: false, message: 'descriptor는 128차원이어야 합니다.' });

  Users.update(req.user.id, { faceDescriptor: descriptor });
  res.json({ success: true, message: '얼굴이 등록되었습니다.' });
});

// ─── 얼굴 로그인 ────────────────────────────────────
router.post('/login', (req, res) => {
  const { descriptor } = req.body;
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128)
    return res.status(400).json({ success: false, message: '유효하지 않은 descriptor입니다.' });

  // 등록된 모든 사용자와 유클리드 거리 비교
  const users = Users.findAll().filter(u => u.isActive && u.faceDescriptor);
  if (users.length === 0)
    return res.status(401).json({ success: false, message: '등록된 얼굴이 없습니다.' });

  let best = null;
  let bestDist = Infinity;
  const THRESHOLD = 0.45; // 임계값 (낮을수록 엄격)

  for (const u of users) {
    const dist = euclideanDistance(descriptor, u.faceDescriptor);
    if (dist < bestDist) { bestDist = dist; best = u; }
  }

  if (!best || bestDist > THRESHOLD) {
    return res.status(401).json({
      success: false,
      message: `얼굴을 인식할 수 없습니다. (거리: ${bestDist.toFixed(3)}, 기준: ${THRESHOLD})`,
    });
  }

  req.session.userId      = best.id;
  req.session.loginMethod = 'face';
  const { password: _, faceDescriptor: __, ...safeUser } = best;
  res.json({ success: true, user: safeUser, distance: bestDist.toFixed(3) });
});

// ─── 내 얼굴 등록 여부 확인 ──────────────────────────
router.get('/status', requireAuth, (req, res) => {
  const user = Users.findById(req.user.id);
  res.json({ success: true, registered: !!user.faceDescriptor });
});

// ─── 얼굴 삭제 ──────────────────────────────────────
router.delete('/unregister', requireAuth, (req, res) => {
  Users.update(req.user.id, { faceDescriptor: null });
  res.json({ success: true, message: '얼굴 정보가 삭제되었습니다.' });
});

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

module.exports = router;
