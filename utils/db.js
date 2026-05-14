const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateCertificate } = require('./certUtils');

const db = { users: [], certificates: [] };

async function initializeDB() {
  const adminId = uuidv4();
  const adminPw = await bcrypt.hash('admin1234', 10);
  const adminCert = generateCertificate({ name: '시스템 관리자', email: 'admin@certauth.local', organization: 'CertAuth System', department: 'Administration' });

  db.users.push({ id: adminId, name: '시스템 관리자', age: 30, email: 'admin@certauth.local', username: 'admin', password: adminPw, role: 'admin', department: 'Administration', organization: 'CertAuth System', createdAt: new Date().toISOString(), isActive: true });
  db.certificates.push({ id: uuidv4(), userId: adminId, userName: '시스템 관리자', userEmail: 'admin@certauth.local', certificate: adminCert.certificate, privateKey: adminCert.privateKey, publicKey: adminCert.publicKey, fingerprint: adminCert.fingerprint, serialNumber: adminCert.serialNumber, notBefore: adminCert.notBefore.toISOString(), notAfter: adminCert.notAfter.toISOString(), status: 'active', issuedAt: new Date().toISOString(), revokedAt: null, revokeReason: null });

  const samples = [
    { name: '김철수', age: 28, email: 'kim@certauth.local', username: 'kimcs', dept: '개발팀' },
    { name: '이영희', age: 34, email: 'lee@certauth.local', username: 'leeyh', dept: '기획팀' },
    { name: '박민준', age: 25, email: 'park@certauth.local', username: 'parkmj', dept: '디자인팀' },
  ];
  for (const u of samples) {
    const userId = uuidv4();
    const pw = await bcrypt.hash('user1234', 10);
    const certData = generateCertificate({ name: u.name, email: u.email, organization: 'CertAuth System', department: u.dept });
    db.users.push({ id: userId, name: u.name, age: u.age, email: u.email, username: u.username, password: pw, role: 'user', department: u.dept, organization: 'CertAuth System', createdAt: new Date().toISOString(), isActive: true });
    db.certificates.push({ id: uuidv4(), userId, userName: u.name, userEmail: u.email, certificate: certData.certificate, privateKey: certData.privateKey, publicKey: certData.publicKey, fingerprint: certData.fingerprint, serialNumber: certData.serialNumber, notBefore: certData.notBefore.toISOString(), notAfter: certData.notAfter.toISOString(), status: 'active', issuedAt: new Date().toISOString(), revokedAt: null, revokeReason: null });
  }

  console.log('✅ DB 초기화 완료');
  console.log('📧 관리자: admin / admin1234');
  console.log('📧 사용자: kimcs / user1234');
}

const Users = {
  findAll: () => db.users,
  findById: (id) => db.users.find(u => u.id === id),
  findByEmail: (email) => db.users.find(u => u.email === email),
  create: (user) => { db.users.push(user); return user; },
  update: (id, updates) => { const i = db.users.findIndex(u => u.id === id); if (i === -1) return null; db.users[i] = { ...db.users[i], ...updates }; return db.users[i]; },
  delete: (id) => { const i = db.users.findIndex(u => u.id === id); if (i === -1) return false; db.users.splice(i, 1); return true; },
};

const Certificates = {
  findAll: () => db.certificates,
  findById: (id) => db.certificates.find(c => c.id === id),
  findByUserId: (userId) => db.certificates.filter(c => c.userId === userId),
  findActiveByUserId: (userId) => db.certificates.find(c => c.userId === userId && c.status === 'active'),
  findByFingerprint: (fp) => db.certificates.find(c => c.fingerprint === fp),
  create: (cert) => { db.certificates.push(cert); return cert; },
  update: (id, updates) => { const i = db.certificates.findIndex(c => c.id === id); if (i === -1) return null; db.certificates[i] = { ...db.certificates[i], ...updates }; return db.certificates[i]; },
};

module.exports = { initializeDB, Users, Certificates };
