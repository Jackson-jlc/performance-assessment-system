// ============================================================
// 钻井经营考核系统 · 后端服务
// 职责：
//   1. 落地存储井库 / 定额库 / 月度填报数据（原来全在浏览器 localStorage，
//      换电脑、清缓存就丢；现在存在服务器的 data/ 目录里）
//   2. 简单账号登录，保护这些数据不被匿名访问
//   3. 顺带把前端页面（public/index.html）托管出去，一个进程就是一整套系统
// ============================================================
require('dotenv').config();
const path = require('path');
const express = require('express');
const cookie = require('cookie');

const store = require('./lib/store');
const auth = require('./lib/auth');
const { seedQuota, seedWells, seedAdmin } = require('./lib/seed');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(express.json({ limit: '8mb' })); // 井库全量 PUT 走一个大 JSON，放宽上限
app.use((req, res, next) => {
  req.cookies = cookie.parse(req.headers.cookie || '');
  next();
});

// ---------------- 启动前置：账号 + 定额基线 seed（幂等，重复启动不会覆盖已有数据）
seedQuota();
seedWells();
seedAdmin();

// ================= 认证 =================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_credentials' });
  const user = auth.findUser(username);
  if (!user || !auth.verifyPassword(user, password)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = auth.signToken(user);
  res.setHeader('Set-Cookie', cookie.serialize(auth.COOKIE_NAME, token, auth.cookieOptions()));
  res.json({ ok: true, user: { username: user.username, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookie.serialize(auth.COOKIE_NAME, '', { ...auth.cookieOptions(), maxAge: 0 }));
  res.json({ ok: true });
});

app.get('/api/auth/me', auth.requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// 账号管理：仅 admin。日常不会天天用，先给最小可用的三个接口。
app.get('/api/users', auth.requireAuth, auth.requireAdmin, (req, res) => {
  res.json(auth.loadUsers().map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt })));
});
app.post('/api/users', auth.requireAuth, auth.requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields' });
  try {
    const id = auth.createUser(username, password, role);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.post('/api/users/:username/password', auth.requireAuth, auth.requireAdmin, (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  try {
    auth.setPassword(req.params.username, password);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ================= 井库（完成井考核库 + 一井一策样本，前端整表读写） =================
app.get('/api/wells', auth.requireAuth, (req, res) => {
  res.json(store.readJSON('wells', []));
});
app.put('/api/wells', auth.requireAuth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'body_must_be_array' });
  store.writeJSON('wells', req.body);
  res.json({ ok: true, count: req.body.length });
});

// ================= 定额库（附件1 基线 + 滚动定额 / 一井一策 补入结果） =================
app.get('/api/quota', auth.requireAuth, (req, res) => {
  res.json(store.readJSON('quota', null));
});
app.put('/api/quota', auth.requireAuth, (req, res) => {
  const q = req.body;
  if (!q || !Array.isArray(q.blocks)) return res.status(400).json({ error: 'invalid_quota_shape' });
  store.writeJSON('quota', q);
  res.json({ ok: true, blocks: q.blocks.length });
});

// ================= 预兑现台账（兑现登记：井号 × 月份，独立于井库） =================
app.get('/api/pre', auth.requireAuth, (req, res) => {
  res.json(store.readJSON('pre', null));   // null = 尚未建账，前端据此决定是否从旧数据迁移
});
app.put('/api/pre', auth.requireAuth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'body_must_be_array' });
  store.writeJSON('pre', req.body);
  res.json({ ok: true, count: req.body.length });
});

// ================= 队伍信息（月度台账：队号 × 年月，前端整表读写） =================
app.get('/api/teaminfo', auth.requireAuth, (req, res) => {
  res.json(store.readJSON('teaminfo', null));   // null = 尚未建账，前端据此初始化队伍名单
});
app.put('/api/teaminfo', auth.requireAuth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'body_must_be_array' });
  store.writeJSON('teaminfo', req.body);
  res.json({ ok: true, count: req.body.length });
});

// ================= 班子绩效手动项（成本兑现奖 / 安全井控 / 重大奖罚 / 党建，按队号 × 年度） =================
app.get('/api/perf', auth.requireAuth, (req, res) => {
  res.json(store.readJSON('perf', null));   // null = 尚未建账，前端按大港队伍名单初始化
});
app.put('/api/perf', auth.requireAuth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'body_must_be_array' });
  store.writeJSON('perf', req.body);
  res.json({ ok: true, count: req.body.length });
});

// ================= 月度填报（切块考核：四口径经营指标与切块参数，按年份分文件） =================
app.get('/api/filings/:year', auth.requireAuth, (req, res) => {
  const year = String(req.params.year).replace(/[^0-9]/g, '');
  res.json(store.readJSON('filings-' + year, null));
});
app.put('/api/filings/:year', auth.requireAuth, (req, res) => {
  const year = String(req.params.year).replace(/[^0-9]/g, '');
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'invalid_body' });
  store.writeJSON('filings-' + year, req.body);
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// ================= 前端静态页面 =================
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[server] 未捕获错误：', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log('钻井经营考核系统后端已启动：http://localhost:' + PORT);
  console.log('数据目录：' + store.DATA_DIR);
});
