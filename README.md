# 🔐 CertAuth System

인증서(PKI) 기반 로그인 및 인증서 관리 시스템

## 🚀 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 서버 시작
```bash
npm start
```

### 3. 브라우저에서 접속
```
http://localhost:3000
```

---

## 🔑 기본 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@certauth.local | admin1234 |
| 일반 사용자 | kim@certauth.local | user1234 |
| 일반 사용자 | lee@certauth.local | user1234 |
| 일반 사용자 | park@certauth.local | user1234 |

---

## 📋 주요 기능

### 사용자 기능
- **비밀번호 로그인** — 이메일 + 비밀번호
- **인증서 로그인** — PEM 파일 업로드 또는 텍스트 붙여넣기
- **내 인증서 조회** — 발급된 인증서 목록 확인
- **인증서 다운로드** — PEM 포맷으로 다운로드

### 관리자 기능
- **대시보드** — 사용자/인증서 통계 현황
- **사용자 관리** — 사용자 추가, 활성화/비활성화, 삭제
- **인증서 자동 발급** — 사용자 생성 시 자동 발급
- **인증서 재발급** — 기존 인증서 대체 후 신규 발급
- **인증서 폐기** — 사유 기록과 함께 폐기
- **인증서 상세 조회** — PEM 내용 및 핑거프린트 확인

---

## 🏗 프로젝트 구조

```
cert-auth-app/
├── server.js              # 서버 진입점
├── routes/
│   ├── auth.js            # 로그인/로그아웃
│   ├── user.js            # 사용자 API
│   └── admin.js           # 관리자 API
├── middleware/
│   └── auth.js            # 인증 미들웨어
├── utils/
│   ├── certUtils.js       # 인증서 생성/파싱
│   └── db.js              # 인메모리 DB
└── public/
    ├── index.html         # SPA 진입점
    ├── css/style.css      # 스타일
    └── js/app.js          # 프론트엔드 로직
```

---

## 🔐 인증서 로그인 방법

1. 관리자 또는 일반 사용자로 **비밀번호 로그인**
2. **내 인증서** 메뉴에서 PEM 파일 다운로드
3. 로그아웃 후 **인증서 로그인** 탭 선택
4. 다운로드한 PEM 파일 업로드 → 자동 로그인

---

## ⚙️ VSCode 실행 팁

- `F5` 또는 터미널에서 `npm start`
- 포트 변경: `PORT=8080 npm start`
- 자동 재시작: `npm install -g nodemon` 후 `nodemon server.js`
"# site" 
