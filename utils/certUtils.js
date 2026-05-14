const forge = require('node-forge');
const { v4: uuidv4 } = require('uuid');

/**
 * 사용자용 인증서 생성
 */
function generateCertificate(userInfo) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = uuidv4().replace(/-/g, '').substring(0, 16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: userInfo.name },
    { name: 'emailAddress', value: userInfo.email },
    { name: 'organizationName', value: userInfo.organization || 'CertAuth System' },
    { shortName: 'OU', value: userInfo.department || 'General' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', clientAuth: true, emailProtection: true },
    {
      name: 'subjectAltName',
      altNames: [{ type: 1, value: userInfo.email }],
    },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const pemCert = forge.pki.certificateToPem(cert);
  const pemPrivateKey = forge.pki.privateKeyToPem(keys.privateKey);
  const pemPublicKey = forge.pki.publicKeyToPem(keys.publicKey);

  const fingerprint = forge.md.sha256
    .create()
    .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
    .digest()
    .toHex()
    .match(/.{2}/g)
    .join(':')
    .toUpperCase();

  return {
    certificate: pemCert,
    privateKey: pemPrivateKey,
    publicKey: pemPublicKey,
    fingerprint,
    serialNumber: cert.serialNumber,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
  };
}

/**
 * PEM 인증서 파싱 및 정보 추출
 */
function parseCertificate(pemCert) {
  try {
    const cert = forge.pki.certificateFromPem(pemCert);
    const subject = {};
    cert.subject.attributes.forEach((attr) => {
      subject[attr.name || attr.shortName] = attr.value;
    });

    const fingerprint = forge.md.sha256
      .create()
      .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
      .digest()
      .toHex()
      .match(/.{2}/g)
      .join(':')
      .toUpperCase();

    return {
      valid: true,
      subject,
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore,
      notAfter: cert.validity.notAfter,
      fingerprint,
      isExpired: new Date() > cert.validity.notAfter,
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * 인증서 만료 여부 체크
 */
function isCertificateValid(pemCert) {
  try {
    const cert = forge.pki.certificateFromPem(pemCert);
    const now = new Date();
    return now >= cert.validity.notBefore && now <= cert.validity.notAfter;
  } catch {
    return false;
  }
}

module.exports = { generateCertificate, parseCertificate, isCertificateValid };
