// ============================================================
// 简易账号体系：用户名+密码登录，JWT 存在 httpOnly cookie 里。
// 不做角色细分（考核办公室内部工具，量不大），只区分 admin / editor：
// admin 能管理账号，editor 能读写井库/定额库/填报数据。
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('./store');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-.env-JWT_SECRET';
const COOKIE_NAME = 'kh_session';
const TOKEN_TTL_DAYS = 14;

if (JWT_SECRET === 'change-me-in-.env-JWT_SECRET') {
  console.warn('[auth] 警告：JWT_SECRET 未在 .env 中设置，正使用默认值——生产环境务必修改！');
}

function loadUsers() {
  return store.readJSON('users', []);
}
function saveUsers(list) {
  store.writeJSON('users', list);
}

// 首次启动若没有任何账号，创建一个默认管理员，密码随机生成并打印一次到日志——
// 避免把默认密码硬编码进代码仓库。
function ensureSeedAdmin() {
  const users = loadUsers();
  if (users.length) return;
  const pass = process.env.SEED_ADMIN_PASSWORD || Math.random().toString(36).slice(2, 10);
  const user = process.env.SEED_ADMIN_USER || 'admin';
  users.push({
    id: 1,
    username: user,
    passwordHash: bcrypt.hashSync(pass, 10),
    role: 'admin',
    createdAt: Date.now()
  });
  saveUsers(users);
  console.log('====================================================');
  console.log('[auth] 已创建初始管理员账号，请立即登录后在“账号管理”里修改密码：');
  console.log('        用户名: ' + user);
  console.log('        密码  : ' + pass);
  console.log('====================================================');
}

function findUser(username) {
  return loadUsers().find(u => u.username === username);
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

function createUser(username, password, role) {
  const users = loadUsers();
  if (users.find(u => u.username === username)) throw new Error('用户名已存在');
  const id = users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
  users.push({
    id,
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role === 'admin' ? 'admin' : 'editor',
    createdAt: Date.now()
  });
  saveUsers(users);
  return id;
}

function setPassword(username, password) {
  const users = loadUsers();
  const u = users.find(x => x.username === username);
  if (!u) throw new Error('用户不存在');
  u.passwordHash = bcrypt.hashSync(password, 10);
  saveUsers(users);
}

function signToken(user) {
  return jwt.sign(
    { uid: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_DAYS + 'd' }
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1', // 部署在 https 后面时在 .env 打开
    maxAge: TOKEN_TTL_DAYS * 24 * 3600 * 1000,
    path: '/'
  };
}

// express 中间件：解析 cookie 里的 JWT，成功则挂 req.user，否则 401。
function requireAuth(req, res, next) {
  const raw = (req.cookies && req.cookies[COOKIE_NAME]) || null;
  if (!raw) return res.status(401).json({ error: 'not_authenticated' });
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = {
  COOKIE_NAME,
  ensureSeedAdmin,
  findUser,
  verifyPassword,
  createUser,
  setPassword,
  signToken,
  cookieOptions,
  requireAuth,
  requireAdmin,
  loadUsers
};
