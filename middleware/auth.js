const { Users } = require('../utils/db');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  const user = Users.findById(req.session.userId);
  if (!user || !user.isActive) {
    req.session.destroy();
    return res.status(401).json({ success: false, message: '유효하지 않은 세션입니다.' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  const user = Users.findById(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }
  req.user = user;
  next();
}

module.exports = { requireAuth, requireAdmin };
