// ─── 상태 ──────────────────────────────────────────
const State = {
  user: null,
  loginMethod: null,
  reg: { name:'', age:0, email:'', dept:'', org:'', username:'', password:'', emailChecked:false, usernameChecked:false },
  issuedCert: null,   // { id, serialNumber, fingerprint, notBefore, notAfter }
  certDownloadUrl: null,
};

// ─── API ───────────────────────────────────────────
async function api(method, url, body) {
  const res = await fetch(url, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
const GET   = u     => api('GET',   u);
const POST  = (u,b) => api('POST',  u, b);
const PATCH = (u,b) => api('PATCH', u, b);
const DEL   = u     => api('DELETE',u);

// ─── 토스트 ────────────────────────────────────────
function toast(msg, type='info') {
  let c = document.getElementById('toast-container');
  if (!c) { c=document.createElement('div'); c.id='toast-container'; document.body.appendChild(c); }
  const el=document.createElement('div'); el.className=`toast toast-${type}`; el.textContent=msg; c.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(()=>el.remove(),300); }, 3000);
}

// ─── 날짜 포맷 ─────────────────────────────────────
function fmtDate(d)     { return d ? new Date(d).toLocaleDateString('ko-KR') : '-'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('ko-KR') : '-'; }
function isExpired(d)      { return d && new Date(d) < new Date(); }
function isExpiringSoon(d) { if (!d) return false; const n=new Date(),t=new Date(d); return t>n && t<new Date(n.getTime()+30*86400000); }

function certBadge(c) {
  if (c.status==='revoked')    return `<span class="badge badge-revoked">● 폐기됨</span>`;
  if (c.status==='superseded') return `<span class="badge badge-superseded">● 대체됨</span>`;
  if (isExpired(c.notAfter))   return `<span class="badge badge-expired">● 만료됨</span>`;
  if (isExpiringSoon(c.notAfter)) return `<span class="badge badge-warn">⚠ 만료임박</span>`;
  return `<span class="badge badge-active">● 유효</span>`;
}

// ─── 모달 ──────────────────────────────────────────
function openModal(html) {
  const bd=document.createElement('div'); bd.className='modal-backdrop';
  bd.innerHTML=`<div class="modal">${html}</div>`;
  bd.addEventListener('click',e=>{ if(e.target===bd) bd.remove(); });
  document.body.appendChild(bd); return bd;
}

// ─── 탭 전환 ───────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
}
window.switchTab = switchTab;

// ─── 스텝 인디케이터 업데이트 ──────────────────────
function setStep(n) {
  for (let i=1; i<=4; i++) {
    const el = document.getElementById(`si-${i}`);
    if (!el) continue;
    el.classList.remove('active','done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }
  // 스텝 라인 색상
  document.querySelectorAll('.step-line').forEach((line, idx) => {
    line.classList.toggle('done', idx < n - 1);
  });
  // 스텝 패널
  for (let i=1; i<=4; i++) {
    const el = document.getElementById(`reg-step${i}`);
    if (el) el.classList.toggle('hidden', i !== n);
  }
  // 완료 단계에서 로그인 링크 숨김
  const link = document.getElementById('reg-login-link');
  if (link) link.classList.toggle('hidden', n === 4);
}

// ─── 비밀번호 강도 ──────────────────────────────────
function calcPwStrength(pw) {
  let s=0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}
function updatePwStrength(pw) {
  const s = calcPwStrength(pw);
  const bars = ['pw-b1','pw-b2','pw-b3','pw-b4'].map(id=>document.getElementById(id));
  const label = document.getElementById('pw-lbl');
  const cls = ['','w1','w2','w3','w4'];
  const txt = ['','약함','보통','강함','매우 강함'];
  const col = ['','var(--danger)','var(--warn)','#7dd','var(--accent)'];
  bars.forEach((b,i) => { b.className='pw-bar'; if(i < s) b.classList.add(cls[s]); });
  if (label) { label.textContent = pw ? txt[s] : ''; label.style.color = col[s]; }
}

// ─── 필드 유효성 ────────────────────────────────────
function setErr(id, msg) {
  const el=document.getElementById(id); if(!el) return;
  el.textContent=msg; el.classList.toggle('show',!!msg);
  // 인풋 찾기 (바로 앞 또는 부모 안에서)
  const wrap=el.closest('.form-group');
  if(wrap) { const inp=wrap.querySelector('.form-input'); if(inp) { inp.classList.toggle('error',!!msg); inp.classList.toggle('ok',false); } }
}
function setOk(inputId, msgId) {
  const inp=document.getElementById(inputId), msg=document.getElementById(msgId);
  if(inp) { inp.classList.remove('error'); inp.classList.add('ok'); }
  if(msg) msg.classList.remove('hidden');
}
function clearOk(inputId, msgId) {
  const inp=document.getElementById(inputId), msg=document.getElementById(msgId);
  if(inp) inp.classList.remove('ok','error');
  if(msg) msg.classList.add('hidden');
}

// ════════════════════════════════════════════════════
// 초기화
// ════════════════════════════════════════════════════
async function init() {
  const res = await GET('/api/auth/me');
  document.getElementById('loading-screen').classList.add('hidden');
  if (res.success) { State.user=res.user; State.loginMethod=res.loginMethod; showDashboard(); }
  else showAuth();
}

// ════════════════════════════════════════════════════
// 인증 페이지
// ════════════════════════════════════════════════════
function showAuth() {
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  bindAuth();
}

function bindAuth() {
  // 탭
  document.querySelectorAll('.auth-tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

  // 비밀번호 보기 토글
  document.querySelectorAll('.pw-toggle').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const inp=document.getElementById(btn.dataset.target);
      if(inp) { inp.type = inp.type==='password' ? 'text' : 'password'; }
    });
  });

  bindLogin();
  bindRegister();
  bindCertLogin();
}

// ── 로그인 ──────────────────────────────────────────
function bindLogin() {
  const doLogin = async () => {
    const id=document.getElementById('login-id').value.trim();
    const pw=document.getElementById('login-pw').value;
    setErr('err-login-id',''); setErr('err-login-pw','');
    const alertEl=document.getElementById('login-alert'); alertEl.classList.add('hidden');
    if (!id) { setErr('err-login-id','아이디 또는 이메일을 입력하세요.'); return; }
    if (!pw) { setErr('err-login-pw','비밀번호를 입력하세요.'); return; }
    const btn=document.getElementById('btn-login'); btn.disabled=true; btn.textContent='로그인 중...';
    const res=await POST('/api/auth/login/password',{username:id,password:pw});
    btn.disabled=false; btn.textContent='로그인';
    if (res.success) { State.user=res.user; State.loginMethod='password'; showDashboard(); }
    else { alertEl.textContent=res.message; alertEl.classList.remove('hidden'); }
  };
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pw').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
}

// ── 회원가입 (3단계) ────────────────────────────────
function bindRegister() {

  // ── STEP 1: 개인정보 ──
  // 이메일 중복 확인
  document.getElementById('btn-check-email').addEventListener('click', async () => {
    const email=document.getElementById('r1-email').value.trim();
    setErr('err-r1-email',''); clearOk('r1-email','ok-r1-email');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('err-r1-email','올바른 이메일을 입력하세요.'); return; }
    const btn=document.getElementById('btn-check-email'); btn.textContent='확인 중...'; btn.disabled=true;
    const res=await POST('/api/auth/check-email',{email});
    btn.disabled=false; btn.textContent='중복확인';
    if (res.available) { setOk('r1-email','ok-r1-email'); State.reg.emailChecked=true; btn.classList.add('checked'); btn.textContent='✓ 확인됨'; }
    else { setErr('err-r1-email', res.message); State.reg.emailChecked=false; }
  });
  document.getElementById('r1-email').addEventListener('input', ()=>{
    State.reg.emailChecked=false;
    clearOk('r1-email','ok-r1-email');
    document.getElementById('btn-check-email').classList.remove('checked');
    document.getElementById('btn-check-email').textContent='중복확인';
  });

  document.getElementById('btn-step1-next').addEventListener('click', () => {
    const name=document.getElementById('r1-name').value.trim();
    const age=document.getElementById('r1-age').value;
    const email=document.getElementById('r1-email').value.trim();
    ['err-r1-name','err-r1-age','err-r1-email'].forEach(id=>setErr(id,''));
    document.getElementById('reg-alert-1').classList.add('hidden');
    let ok=true;
    if (!name) { setErr('err-r1-name','이름을 입력하세요.'); ok=false; }
    if (!age || isNaN(parseInt(age)) || parseInt(age)<1 || parseInt(age)>150) { setErr('err-r1-age','올바른 나이를 입력하세요.'); ok=false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('err-r1-email','올바른 이메일을 입력하세요.'); ok=false; }
    else if (!State.reg.emailChecked) { setErr('err-r1-email','이메일 중복 확인을 해주세요.'); ok=false; }
    if (!ok) return;
    State.reg.name=name; State.reg.age=parseInt(age); State.reg.email=email;
    State.reg.dept=document.getElementById('r1-dept').value.trim();
    State.reg.org=document.getElementById('r1-org').value.trim();
    // 스텝 2 요약 표시
    document.getElementById('step2-summary').innerHTML =
      `<strong>${name}</strong> · ${age}세 · <strong>${email}</strong>` +
      (State.reg.dept ? ` · ${State.reg.dept}` : '');
    setStep(2);
  });

  // ── STEP 2: 계정 설정 ──
  // 아이디 중복 확인
  document.getElementById('btn-check-username').addEventListener('click', async () => {
    const username=document.getElementById('r2-username').value.trim();
    setErr('err-r2-username',''); clearOk('r2-username','ok-r2-username');
    if (!username || username.length<4 || username.length>20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setErr('err-r2-username','영문, 숫자, 밑줄(_) 4~20자로 입력하세요.'); return;
    }
    const btn=document.getElementById('btn-check-username'); btn.textContent='확인 중...'; btn.disabled=true;
    const res=await POST('/api/auth/check-username',{username});
    btn.disabled=false; btn.textContent='중복확인';
    if (res.available) { setOk('r2-username','ok-r2-username'); State.reg.usernameChecked=true; btn.classList.add('checked'); btn.textContent='✓ 확인됨'; }
    else { setErr('err-r2-username', res.message); State.reg.usernameChecked=false; }
  });
  document.getElementById('r2-username').addEventListener('input', ()=>{
    State.reg.usernameChecked=false;
    clearOk('r2-username','ok-r2-username');
    document.getElementById('btn-check-username').classList.remove('checked');
    document.getElementById('btn-check-username').textContent='중복확인';
  });

  document.getElementById('r2-pw').addEventListener('input', e=>updatePwStrength(e.target.value));

  document.getElementById('btn-step2-prev').addEventListener('click', ()=>setStep(1));

  document.getElementById('btn-step2-next').addEventListener('click', async () => {
    const username=document.getElementById('r2-username').value.trim();
    const pw=document.getElementById('r2-pw').value;
    const pw2=document.getElementById('r2-pw2').value;
    ['err-r2-username','err-r2-pw','err-r2-pw2'].forEach(id=>setErr(id,''));
    document.getElementById('reg-alert-2').classList.add('hidden');
    let ok=true;
    if (!username || username.length<4 || username.length>20 || !/^[a-zA-Z0-9_]+$/.test(username)) { setErr('err-r2-username','영문, 숫자, 밑줄(_) 4~20자로 입력하세요.'); ok=false; }
    else if (!State.reg.usernameChecked) { setErr('err-r2-username','아이디 중복 확인을 해주세요.'); ok=false; }
    if (!pw || pw.length<6) { setErr('err-r2-pw','비밀번호는 6자 이상이어야 합니다.'); ok=false; }
    if (pw !== pw2) { setErr('err-r2-pw2','비밀번호가 일치하지 않습니다.'); ok=false; }
    if (!ok) return;
    State.reg.username=username; State.reg.password=pw;
    setStep(3);
    await issueCertificate();
  });

  // ── STEP 3: 인증서 발급 ──
  document.getElementById('btn-step2-next'); // already bound above

  document.getElementById('btn-download-cert').addEventListener('click', downloadCert);

  document.getElementById('btn-step3-next').addEventListener('click', async () => {
    // 최종 확정 → 회원가입 완료
    const res=await POST('/api/auth/register/confirm',{});
    if (res.success) {
      State.user=res.user; State.loginMethod='password';
      document.getElementById('done-name').textContent=res.user.name;
      document.getElementById('done-username').textContent=res.user.username;
      setStep(4);
    } else {
      const a=document.getElementById('reg-alert-3'); a.textContent=res.message; a.classList.remove('hidden');
    }
  });

  // ── STEP 4: 완료 ──
  document.getElementById('btn-done-download').addEventListener('click', downloadCert);
  document.getElementById('btn-goto-dashboard').addEventListener('click', ()=>showDashboard());
}

async function issueCertificate() {
  // 스피너 표시
  document.getElementById('cert-issuing').classList.remove('hidden');
  document.getElementById('cert-issued').classList.add('hidden');
  document.getElementById('step3-nav').classList.add('hidden');

  // 서버에 미리 발급 요청
  const res=await POST('/api/auth/register/preview-cert',{
    name: State.reg.name, age: State.reg.age, email: State.reg.email,
    username: State.reg.username, password: State.reg.password,
    department: State.reg.dept, organization: State.reg.org,
  });

  // 최소 1.5초 대기 (발급 애니메이션)
  await new Promise(r=>setTimeout(r,1500));

  if (!res.success) {
    document.getElementById('cert-issuing').classList.add('hidden');
    const a=document.getElementById('reg-alert-3'); a.textContent=res.message; a.classList.remove('hidden');
    return;
  }

  State.issuedCert=res.certPreview;
  const p=res.certPreview;
  document.getElementById('ci-owner').textContent=p.subject.name;
  document.getElementById('ci-email').textContent=p.subject.email;
  document.getElementById('ci-serial').textContent=p.serialNumber;
  document.getElementById('ci-validity').textContent=`${fmtDate(p.notBefore)} ~ ${fmtDate(p.notAfter)}`;
  document.getElementById('ci-fp').textContent=p.fingerprint;

  document.getElementById('cert-issuing').classList.add('hidden');
  document.getElementById('cert-issued').classList.remove('hidden');
  document.getElementById('step3-nav').classList.remove('hidden');
}

function downloadCert() {
  if (!State.issuedCert) return;
  // 인증서는 confirm 후 세션으로 다운로드
  window.location.href=`/api/user/me/certificates/latest/download`;
}

// ── 인증서 로그인 ────────────────────────────────────
function bindCertLogin() {
  const drop=document.getElementById('cert-drop');
  const fileInput=document.getElementById('cert-file');
  drop.addEventListener('click',()=>fileInput.click());
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');if(e.dataTransfer.files[0]) loadCertFile(e.dataTransfer.files[0]);});
  fileInput.addEventListener('change',()=>{if(fileInput.files[0]) loadCertFile(fileInput.files[0]);});
  document.getElementById('btn-cert-clear').addEventListener('click', clearCert);

  const doLogin=async()=>{
    const cert=document.getElementById('cert-text').value.trim();
    const alertEl=document.getElementById('cert-login-alert'); alertEl.classList.add('hidden');
    if (!cert) { alertEl.textContent='인증서를 업로드하거나 붙여넣기 하세요.'; alertEl.classList.remove('hidden'); return; }
    const btn=document.getElementById('btn-cert-login'); btn.disabled=true; btn.textContent='인증 중...';
    const res=await POST('/api/auth/login/certificate',{certificate:cert});
    btn.disabled=false; btn.textContent='인증서로 로그인';
    if (res.success) { State.user=res.user; State.loginMethod='certificate'; showDashboard(); }
    else { alertEl.textContent=res.message; alertEl.classList.remove('hidden'); }
  };
  document.getElementById('btn-cert-login').addEventListener('click', doLogin);
}

function loadCertFile(file) {
  const reader=new FileReader();
  reader.onload=e=>{
    document.getElementById('cert-text').value=e.target.result;
    document.getElementById('cert-loaded-name').textContent=file.name;
    document.getElementById('cert-loaded-bar').classList.remove('hidden');
    document.getElementById('cert-drop').classList.add('hidden');
  };
  reader.readAsText(file);
}
function clearCert() {
  document.getElementById('cert-text').value='';
  document.getElementById('cert-loaded-bar').classList.add('hidden');
  document.getElementById('cert-drop').classList.remove('hidden');
  document.getElementById('cert-file').value='';
}

// ════════════════════════════════════════════════════
// 대시보드
// ════════════════════════════════════════════════════
function showDashboard() {
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('dashboard-page').classList.remove('hidden');

  document.getElementById('sb-name').textContent=State.user.name;
  document.getElementById('sb-meta').textContent=`${State.user.role} · ${State.user.age||'-'}세`;
  document.getElementById('sb-avatar').textContent=State.user.name[0];
  if (State.user.role==='admin') document.getElementById('admin-nav').classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(item=>{
    item.addEventListener('click',e=>{
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      navigate(item.dataset.view);
    });
  });

  document.getElementById('btn-logout').addEventListener('click', async()=>{
    await POST('/api/auth/logout');
    State.user=null; State.issuedCert=null;
    document.getElementById('dashboard-page').classList.add('hidden');
    // 회원가입 폼 초기화
    setStep(1);
    State.reg={name:'',age:0,email:'',dept:'',org:'',username:'',password:'',emailChecked:false,usernameChecked:false};
    showAuth();
  });

  navigate('overview');
}

function navigate(view) {
  const c=document.getElementById('view-container');
  const views={overview:renderOverview, profile:renderProfile, 'my-certs':renderMyCerts, 'admin-users':renderAdminUsers, 'admin-certs':renderAdminCerts};
  if (views[view]) views[view](c);
}

// ─── 뷰: 개요 ──────────────────────────────────────
async function renderOverview(c) {
  c.innerHTML='<div style="padding:20px;color:var(--text-muted)">로딩 중...</div>';
  const mi={password:'🔑 비밀번호 로그인', certificate:'🔐 인증서 로그인'};
  const methodLabel=mi[State.loginMethod]||'로그인';

  let stats='';
  if (State.user.role==='admin') {
    const s=await GET('/api/admin/stats');
    if (s.success) stats=`<div class="stats-grid">
      <div class="stat-card"><div class="stat-label">전체 사용자</div><div class="stat-value">${s.stats.totalUsers}</div></div>
      <div class="stat-card"><div class="stat-label">활성 사용자</div><div class="stat-value accent">${s.stats.activeUsers}</div></div>
      <div class="stat-card"><div class="stat-label">발급 인증서</div><div class="stat-value">${s.stats.totalCerts}</div></div>
      <div class="stat-card"><div class="stat-label">유효 인증서</div><div class="stat-value accent">${s.stats.activeCerts}</div></div>
      <div class="stat-card"><div class="stat-label">폐기됨</div><div class="stat-value danger">${s.stats.revokedCerts}</div></div>
      <div class="stat-card"><div class="stat-label">만료 임박</div><div class="stat-value warn">${s.stats.expiringSoon}</div></div>
    </div>`;
  }

  const cr=await GET('/api/user/me/certificates');
  const activeCert=cr.success?cr.certificates.find(c=>c.status==='active'):null;

  c.innerHTML=`
    <div class="view-header view-header-row">
      <div>
        <h1 class="view-title">안녕하세요, ${State.user.name}님 👋</h1>
        <p class="view-desc">${State.user.email} · ${State.user.age}세 · ${State.user.department||'부서 미지정'}</p>
      </div>
      <span style="background:var(--accent-dim);color:var(--accent);border:1px solid rgba(0,212,170,0.25);padding:6px 14px;border-radius:100px;font-size:12px;font-family:'JetBrains Mono',monospace;white-space:nowrap">${methodLabel}</span>
    </div>
    ${stats}
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">내 인증서 현황</div><div class="card-sub">현재 활성 인증서</div></div>
      </div>
      ${activeCert?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div><div class="profile-key">상태</div><div>${certBadge(activeCert)}</div></div>
          <div><div class="profile-key">만료일</div><div class="profile-val" style="font-size:13px">${fmtDate(activeCert.notAfter)}</div></div>
          <div style="grid-column:1/-1"><div class="profile-key">시리얼 번호</div><div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${activeCert.serialNumber}</div></div>
          <div style="grid-column:1/-1"><div class="profile-key">핑거프린트</div><div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text-muted);word-break:break-all">${activeCert.fingerprint}</div></div>
        </div>
        <div style="margin-top:16px"><a href="/api/user/me/certificates/${activeCert.id}/download" class="btn btn-secondary btn-sm" style="width:auto">⬇ PEM 다운로드</a></div>
      `:`<div class="empty-state"><div class="empty-icon">🔐</div><p>활성 인증서 없음</p></div>`}
    </div>`;
}

// ─── 뷰: 프로필 ────────────────────────────────────
function renderProfile(c) {
  const u=State.user;
  c.innerHTML=`
    <div class="view-header"><h1 class="view-title">내 프로필</h1><p class="view-desc">등록된 내 계정 정보</p></div>
    <div class="card">
      <div class="card-header"><div class="card-title">기본 정보</div></div>
      <div class="profile-grid">
        <div><div class="profile-key">이름</div><div class="profile-val">${u.name}</div></div>
        <div><div class="profile-key">나이</div><div class="profile-val">${u.age}세</div></div>
        <div><div class="profile-key">아이디</div><div class="profile-val" style="font-family:'JetBrains Mono',monospace">${u.username||'-'}</div></div>
        <div><div class="profile-key">이메일</div><div class="profile-val" style="font-size:13px">${u.email}</div></div>
        <div><div class="profile-key">역할</div><div class="profile-val"><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role}</span></div></div>
        <div><div class="profile-key">부서</div><div class="profile-val">${u.department||'-'}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:12px">인증서 로그인 이용 방법</div>
      <p style="color:var(--text-muted);font-size:13px;line-height:2.2">
        <span style="color:var(--accent)">①</span> <strong>내 인증서</strong> 메뉴에서 PEM 파일 다운로드<br>
        <span style="color:var(--accent)">②</span> 로그아웃 후 <strong>인증서 로그인</strong> 탭 선택<br>
        <span style="color:var(--accent)">③</span> PEM 파일 업로드 → 비밀번호 없이 로그인
      </p>
    </div>`;
}

// ─── 뷰: 내 인증서 ─────────────────────────────────
async function renderMyCerts(c) {
  c.innerHTML='<div style="padding:20px;color:var(--text-muted)">로딩 중...</div>';
  const res=await GET('/api/user/me/certificates');
  if (!res.success) { c.innerHTML=`<p style="color:var(--danger)">${res.message}</p>`; return; }
  const rows=res.certificates.length===0
    ?`<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🔐</div><p>인증서 없음</p></div></td></tr>`
    :res.certificates.map(cert=>`<tr>
        <td class="td-mono" style="font-size:10px">${cert.serialNumber}</td>
        <td>${certBadge(cert)}</td>
        <td class="td-mono">${fmtDate(cert.notBefore)}</td>
        <td class="td-mono">${fmtDate(cert.notAfter)}</td>
        <td class="td-mono" style="font-size:9px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${cert.fingerprint}">${cert.fingerprint}</td>
        <td>${cert.status==='active'?`<a href="/api/user/me/certificates/${cert.id}/download" class="btn btn-secondary btn-sm">⬇ PEM</a>`:''}</td>
      </tr>`).join('');

  c.innerHTML=`
    <div class="view-header"><h1 class="view-title">내 인증서</h1><p class="view-desc">발급된 인증서 목록</p></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>시리얼 번호</th><th>상태</th><th>발급일</th><th>만료일</th><th>핑거프린트</th><th>다운로드</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div></div>`;
}

// ─── 뷰: 관리자 - 사용자 ───────────────────────────
async function renderAdminUsers(c) {
  c.innerHTML='<div style="padding:20px;color:var(--text-muted)">로딩 중...</div>';
  const res=await GET('/api/admin/users');
  if (!res.success) { c.innerHTML=`<p style="color:var(--danger)">권한이 없습니다.</p>`; return; }
  let filter='';
  const getRows=users=>{
    const f=users.filter(u=>u.name.includes(filter)||u.email.includes(filter)||(u.username||'').includes(filter)||(u.department||'').includes(filter)||(String(u.age||'')).includes(filter));
    if (!f.length) return `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👤</div><p>검색 결과 없음</p></div></td></tr>`;
    return f.map(u=>`<tr>
      <td><strong>${u.name}</strong></td>
      <td class="td-mono">${u.username||'-'}</td>
      <td style="color:var(--text-muted)">${u.age||'-'}세</td>
      <td class="td-mono" style="font-size:11px">${u.email}</td>
      <td>${u.department||'-'}</td>
      <td><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role}</span></td>
      <td><span class="badge ${u.isActive?'badge-active':'badge-revoked'}">${u.isActive?'활성':'비활성'}</span></td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="issueCert('${u.id}','${u.name}')">🔐 인증서발급</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleUser('${u.id}','${u.isActive}')">${u.isActive?'비활성화':'활성화'}</button>
        ${u.id!==State.user.id?`<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}','${u.name}')">삭제</button>`:''}
      </div></td>
    </tr>`).join('');
  };
  c.innerHTML=`
    <div class="view-header view-header-row">
      <div><h1 class="view-title">사용자 관리</h1><p class="view-desc">가입 사용자 목록 및 인증서 관리</p></div>
      <button class="btn btn-primary btn-sm" id="btn-add-user">+ 사용자 추가</button>
    </div>
    <div class="search-bar"><input class="search-input" id="user-search" placeholder="이름, 아이디, 나이, 이메일, 부서 검색..." /></div>
    <div class="card"><div class="table-wrap"><table id="users-table">
      <thead><tr><th>이름</th><th>아이디</th><th>나이</th><th>이메일</th><th>부서</th><th>역할</th><th>상태</th><th>액션</th></tr></thead>
      <tbody>${getRows(res.users)}</tbody>
    </table></div></div>`;
  document.getElementById('user-search').addEventListener('input',e=>{filter=e.target.value;document.querySelector('#users-table tbody').innerHTML=getRows(res.users);});
  document.getElementById('btn-add-user').addEventListener('click',()=>showAddUserModal(()=>renderAdminUsers(c)));
}

function showAddUserModal(onDone) {
  const modal=openModal(`
    <h2 class="modal-title">새 사용자 추가</h2>
    <p style="color:var(--text-muted);font-size:12px;margin-bottom:16px">생성 시 인증서가 자동 발급됩니다.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">이름 *</label><input class="form-input" id="m-name" placeholder="홍길동" /></div>
      <div class="form-group"><label class="form-label">나이 *</label><input class="form-input" id="m-age" type="number" placeholder="25" /></div>
    </div>
    <div class="form-group"><label class="form-label">아이디 *</label><input class="form-input" id="m-username" placeholder="영문, 숫자 4~20자" /></div>
    <div class="form-group"><label class="form-label">이메일 *</label><input class="form-input" id="m-email" type="email" placeholder="user@example.com" /></div>
    <div class="form-group"><label class="form-label">비밀번호 *</label><input class="form-input" id="m-pw" type="password" placeholder="6자 이상" /></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">부서</label><input class="form-input" id="m-dept" placeholder="개발팀" /></div>
      <div class="form-group"><label class="form-label">조직</label><input class="form-input" id="m-org" placeholder="회사명" /></div>
    </div>
    <div class="form-group"><label class="form-label">역할</label>
      <select class="form-input" id="m-role"><option value="user">일반 사용자</option><option value="admin">관리자</option></select>
    </div>
    <div id="m-err" class="alert alert-error hidden"></div>
    <div class="modal-footer">
      <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">취소</button>
      <button class="btn btn-primary btn-sm" id="m-confirm">생성 및 인증서 발급</button>
    </div>`);
  modal.querySelector('#m-confirm').addEventListener('click', async()=>{
    const name=modal.querySelector('#m-name').value.trim(), age=modal.querySelector('#m-age').value;
    const username=modal.querySelector('#m-username').value.trim(), email=modal.querySelector('#m-email').value.trim();
    const pw=modal.querySelector('#m-pw').value, dept=modal.querySelector('#m-dept').value.trim();
    const org=modal.querySelector('#m-org').value.trim(), role=modal.querySelector('#m-role').value;
    const err=modal.querySelector('#m-err'); err.classList.add('hidden');
    if (!name||!age||!username||!email||!pw) { err.textContent='필수 항목을 모두 입력하세요.'; err.classList.remove('hidden'); return; }
    const btn=modal.querySelector('#m-confirm'); btn.disabled=true; btn.textContent='처리 중...';
    const res=await POST('/api/admin/users',{name,age,username,email,password:pw,department:dept,organization:org,role});
    if (res.success) { modal.remove(); toast(`${name}님 계정 생성 완료`,'success'); if(onDone) onDone(); }
    else { btn.disabled=false; btn.textContent='생성 및 인증서 발급'; err.textContent=res.message; err.classList.remove('hidden'); }
  });
}

async function toggleUser(id, isActive) {
  const res=await PATCH(`/api/admin/users/${id}/toggle`);
  if (res.success) { toast(res.isActive?'계정 활성화됨':'계정 비활성화됨','success'); navigate('admin-users'); }
  else toast(res.message,'error');
}
async function deleteUser(id, name) {
  const m=openModal(`<h2 class="modal-title" style="color:var(--danger)">사용자 삭제</h2>
    <p style="margin-bottom:20px"><strong>${name}</strong>을(를) 삭제하시겠습니까?</p>
    <div class="modal-footer">
      <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">취소</button>
      <button class="btn btn-danger btn-sm" id="del-ok">삭제</button>
    </div>`);
  m.querySelector('#del-ok').addEventListener('click', async()=>{
    const res=await DEL(`/api/admin/users/${id}`); m.remove();
    if (res.success) { toast(`${name} 삭제됨`,'success'); navigate('admin-users'); }
    else toast(res.message,'error');
  });
}
async function issueCert(userId, name) {
  const m=openModal(`<h2 class="modal-title">인증서 재발급</h2>
    <p style="margin-bottom:20px"><strong>${name}</strong>님에게 새 인증서를 발급합니다.<br>기존 활성 인증서는 자동 대체됩니다.</p>
    <div class="modal-footer">
      <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">취소</button>
      <button class="btn btn-primary btn-sm" id="issue-ok">발급</button>
    </div>`);
  m.querySelector('#issue-ok').addEventListener('click', async()=>{
    const btn=m.querySelector('#issue-ok'); btn.disabled=true; btn.textContent='발급 중...';
    const res=await POST(`/api/admin/certificates/issue/${userId}`); m.remove();
    if (res.success) { toast(`${name}님 인증서 발급 완료`,'success'); navigate('admin-users'); }
    else toast(res.message,'error');
  });
}

// ─── 뷰: 관리자 - 인증서 ───────────────────────────
async function renderAdminCerts(c) {
  c.innerHTML='<div style="padding:20px;color:var(--text-muted)">로딩 중...</div>';
  const res=await GET('/api/admin/certificates');
  if (!res.success) { c.innerHTML=`<p style="color:var(--danger)">권한이 없습니다.</p>`; return; }
  let filter='';
  const getRows=certs=>{
    const f=certs.filter(cert=>cert.userName.includes(filter)||cert.userEmail.includes(filter)||cert.serialNumber.includes(filter));
    if (!f.length) return `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🛡️</div><p>인증서 없음</p></div></td></tr>`;
    return f.map(cert=>`<tr>
      <td><strong>${cert.userName}</strong><br><span style="font-size:10px;color:var(--text-muted)">${cert.userEmail}</span></td>
      <td class="td-mono" style="font-size:10px">${cert.serialNumber}</td>
      <td>${certBadge(cert)}</td>
      <td class="td-mono">${fmtDate(cert.notBefore)}</td>
      <td class="td-mono">${fmtDate(cert.notAfter)}</td>
      <td class="td-mono" style="font-size:9px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${cert.fingerprint}">${cert.fingerprint}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="viewCert('${cert.id}')">상세</button>
        <a href="/api/admin/certificates/${cert.id}/download" class="btn btn-secondary btn-sm">⬇</a>
        ${cert.status==='active'?`<button class="btn btn-danger btn-sm" onclick="revokeCert('${cert.id}','${cert.userName}')">폐기</button>`:''}
      </div></td>
    </tr>`).join('');
  };
  c.innerHTML=`
    <div class="view-header"><h1 class="view-title">인증서 관리</h1><p class="view-desc">발급된 모든 인증서 조회 및 폐기</p></div>
    <div class="search-bar"><input class="search-input" id="cert-search" placeholder="사용자명, 이메일, 시리얼 번호 검색..." /></div>
    <div class="card"><div class="table-wrap"><table id="certs-table">
      <thead><tr><th>사용자</th><th>시리얼 번호</th><th>상태</th><th>발급일</th><th>만료일</th><th>핑거프린트</th><th>액션</th></tr></thead>
      <tbody>${getRows(res.certificates)}</tbody>
    </table></div></div>`;
  document.getElementById('cert-search').addEventListener('input',e=>{filter=e.target.value;document.querySelector('#certs-table tbody').innerHTML=getRows(res.certificates);});
}

async function viewCert(certId) {
  const res=await GET(`/api/admin/certificates/${certId}/detail`);
  if (!res.success) { toast('불러오기 실패','error'); return; }
  const cert=res.certificate;
  openModal(`<h2 class="modal-title">인증서 상세</h2>
    <div style="display:grid;gap:12px;margin-bottom:16px">
      <div><div class="profile-key">소유자</div><div>${cert.userName} (${cert.userEmail})</div></div>
      <div><div class="profile-key">상태</div><div>${certBadge(cert)}</div></div>
      <div><div class="profile-key">시리얼 번호</div><div class="td-mono" style="font-size:11px">${cert.serialNumber}</div></div>
      <div><div class="profile-key">핑거프린트</div><div class="td-mono" style="font-size:9px;word-break:break-all">${cert.fingerprint}</div></div>
      <div><div class="profile-key">유효 기간</div><div>${fmtDate(cert.notBefore)} ~ ${fmtDate(cert.notAfter)}</div></div>
      ${cert.revokedAt?`<div><div class="profile-key">폐기</div><div style="color:var(--danger)">${fmtDateTime(cert.revokedAt)} — ${cert.revokeReason}</div></div>`:''}
      <div><div class="profile-key" style="margin-bottom:6px">인증서 PEM</div><div class="pem-box">${cert.certificate}</div></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">닫기</button>
      <a href="/api/admin/certificates/${certId}/download" class="btn btn-primary btn-sm">⬇ PEM 다운로드</a>
    </div>`);
}

async function revokeCert(certId, name) {
  const m=openModal(`<h2 class="modal-title" style="color:var(--danger)">인증서 폐기</h2>
    <p style="margin-bottom:14px"><strong>${name}</strong>의 인증서를 폐기합니다.</p>
    <div class="form-group"><label class="form-label">폐기 사유</label>
      <input class="form-input" id="revoke-reason" placeholder="분실, 퇴직, 보안 이슈 등" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">취소</button>
      <button class="btn btn-danger btn-sm" id="revoke-ok">폐기 확인</button>
    </div>`);
  m.querySelector('#revoke-ok').addEventListener('click', async()=>{
    const reason=m.querySelector('#revoke-reason').value||'관리자에 의해 폐기됨';
    const res=await POST(`/api/admin/certificates/${certId}/revoke`,{reason}); m.remove();
    if (res.success) { toast('인증서가 폐기되었습니다.','success'); navigate('admin-certs'); }
    else toast(res.message,'error');
  });
}

init();
