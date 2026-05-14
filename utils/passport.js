const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const NaverStrategy = require('passport-naver-v2').Strategy;
const { v4: uuidv4 } = require('uuid');
const { Users, Certificates } = require('../utils/db');
const { generateCertificate } = require('../utils/certUtils');

// ─── 직렬화 / 역직렬화 ──────────────────────────────
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = Users.findById(id);
  done(null, user || false);
});

// ─── 소셜 로그인 공통: 사용자 찾기 or 생성 ────────────
async function findOrCreateSocialUser({ provider, providerId, name, email, profileImage }) {
  // 이미 같은 소셜 계정으로 가입된 사용자 확인
  let user = Users.findAll().find(
    (u) => u.provider === provider && u.providerId === providerId
  );

  if (user) return user;

  // 같은 이메일로 가입된 계정이 있으면 소셜 연동
  if (email) {
    const existing = Users.findByEmail(email);
    if (existing) {
      Users.update(existing.id, { provider, providerId, profileImage });
      return Users.findById(existing.id);
    }
  }

  // 신규 사용자 생성 + 인증서 자동 발급
  const userId = uuidv4();
  const finalEmail = email || `${provider}_${providerId}@social.certauth`;

  user = Users.create({
    id: userId,
    name: name || '소셜 사용자',
    email: finalEmail,
    password: null, // 소셜 로그인은 비밀번호 없음
    role: 'user',
    department: '미지정',
    organization: 'CertAuth System',
    provider,       // 'google' | 'naver'
    providerId,
    profileImage: profileImage || null,
    createdAt: new Date().toISOString(),
    isActive: true,
  });

  // 인증서 자동 발급
  const certData = generateCertificate({
    name: user.name,
    email: finalEmail,
    organization: 'CertAuth System',
    department: '소셜 로그인',
  });

  Certificates.create({
    id: uuidv4(),
    userId,
    userName: user.name,
    userEmail: finalEmail,
    certificate: certData.certificate,
    privateKey: certData.privateKey,
    publicKey: certData.publicKey,
    fingerprint: certData.fingerprint,
    serialNumber: certData.serialNumber,
    notBefore: certData.notBefore.toISOString(),
    notAfter: certData.notAfter.toISOString(),
    status: 'active',
    issuedAt: new Date().toISOString(),
    revokedAt: null,
    revokeReason: null,
  });

  console.log(`✅ 소셜 신규 가입: [${provider}] ${user.name} (${finalEmail})`);
  return user;
}

// ─── Google Strategy ────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== '여기에_구글_클라이언트_ID') {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateSocialUser({
            provider: 'google',
            providerId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value,
            profileImage: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
  console.log('✅ Google OAuth 활성화됨');
} else {
  console.log('⚠️  Google OAuth 비활성화 (.env에 GOOGLE_CLIENT_ID 없음)');
}

// ─── Naver Strategy ─────────────────────────────
if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_ID !== '여기에_네이버_클라이언트_ID') {
  passport.use(
    new NaverStrategy(
      {
        clientID: process.env.NAVER_CLIENT_ID,
        clientSecret: process.env.NAVER_CLIENT_SECRET,
        callbackURL: process.env.NAVER_CALLBACK_URL || 'http://localhost:3000/api/auth/naver/callback',
      },
      async (accessToken, refreshToken, params, profile, done) => {
        try {
          const user = await findOrCreateSocialUser({
            provider: 'naver',
            providerId: profile.id,
            name: profile.displayName || profile.nickname,
            email: profile.email,
            profileImage: profile.profileImage,
          });
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
  console.log('✅ Naver OAuth 활성화됨');
} else {
  console.log('⚠️  Naver OAuth 비활성화 (.env에 NAVER_CLIENT_ID 없음)');
}

module.exports = passport;
