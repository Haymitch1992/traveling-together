const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('./db');
const config = require('./config');
const { nearestRegion } = require('./region');
const { requireAuth, requireWrite } = require('./auth');

const router = express.Router();
const uploadRoot = path.join(__dirname, 'data', 'uploads');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TRANSPORTS = ['驾车', '骑行', '步行', '火车', '飞机', '其他'];

function bad(res, msg) { return res.status(400).json({ error: msg }); }
function notFound(res, msg = '资源不存在') { return res.status(404).json({ error: msg }); }
function round2(n) { return Math.round(n * 100) / 100; }

function findOwnTrip(tripId, userId) {
  if (!Number.isInteger(tripId)) return null;
  return db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(tripId, userId);
}

function findOwnChild(table, id, tripId) {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ? AND trip_id = ?`).get(id, tripId);
}

function listDestinations(tripId) {
  return db.prepare(
    'SELECT id, name, lat, lng, country, sort_order FROM trip_destinations WHERE trip_id = ? ORDER BY sort_order, id'
  ).all(tripId);
}

function formatDestName(dests) {
  return dests.map((d) => d.name).join(' · ');
}

/** @returns {Array|{error:string}} */
function normalizeDestinations(body) {
  let list = body && body.destinations;
  if (!Array.isArray(list) || !list.length) {
    if (body && body.dest_name && typeof body.dest_lat === 'number' && typeof body.dest_lng === 'number') {
      list = [{
        name: body.dest_name,
        lat: body.dest_lat,
        lng: body.dest_lng,
        country: body.dest_country,
      }];
    } else {
      return { error: '请至少添加一个目的地' };
    }
  }
  if (list.length > 20) return { error: '目的地最多 20 个' };
  const out = [];
  const seen = new Set();
  for (const d of list) {
    if (!d || typeof d.name !== 'string' || !d.name.trim()) return { error: '目的地名称无效' };
    const name = d.name.trim().slice(0, 50);
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number' ||
        Math.abs(d.lat) > 90 || Math.abs(d.lng) > 180) return { error: '目的地坐标无效' };
    const key = `${name}|${d.lat.toFixed(4)}|${d.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      lat: d.lat,
      lng: d.lng,
      country: typeof d.country === 'string' && d.country.trim() ? d.country.trim() : '未知',
    });
  }
  if (!out.length) return { error: '请至少添加一个目的地' };
  return out;
}

function replaceDestinations(tripId, dests) {
  db.prepare('DELETE FROM trip_destinations WHERE trip_id = ?').run(tripId);
  const ins = db.prepare(
    'INSERT INTO trip_destinations (trip_id, name, lat, lng, country, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  dests.forEach((d, i) => ins.run(tripId, d.name, d.lat, d.lng, d.country || null, i));
}

// ---------- 分摊计算 ----------
function settle(members, expenses) {
  const paidBy = {};
  members.forEach((m) => { paidBy[m.name] = 0; });
  let total = 0;
  expenses.forEach((e) => {
    if (paidBy[e.payer] === undefined) paidBy[e.payer] = 0;
    paidBy[e.payer] += e.amount;
    total += e.amount;
  });
  const names = members.map((m) => m.name);
  const share = names.length ? total / names.length : 0;
  const balances = names.map((n) => ({
    name: n,
    paid: round2(paidBy[n] || 0),
    share: round2(share),
    balance: round2((paidBy[n] || 0) - share),
  }));
  const debtors = balances.filter((b) => b.balance < -0.005).map((b) => ({ name: b.name, amt: -b.balance }));
  const creditors = balances.filter((b) => b.balance > 0.005).map((b) => ({ name: b.name, amt: b.balance }));
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: round2(pay) });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.005) i++;
    if (creditors[j].amt < 0.005) j++;
  }
  return { total: round2(total), perPerson: round2(share), balances, transfers };
}

// ---------- 个人资料 ----------
function avatarUrl(userId, filename) {
  return filename ? `/uploads/avatars/${userId}/${filename}` : null;
}

router.get('/profile', requireAuth, (req, res) => {
  const u = db.prepare('SELECT username, email, home_name, home_lat, home_lng, avatar FROM users WHERE id = ?').get(req.auth.userId);
  res.json({
    ...u,
    avatarUrl: avatarUrl(req.auth.userId, u && u.avatar),
  });
});

router.put('/profile', requireAuth, requireWrite, (req, res) => {
  const { home_name, home_lat, home_lng } = req.body || {};
  if (!home_name || typeof home_name !== 'string') return bad(res, 'home_name 必填');
  if (typeof home_lat !== 'number' || typeof home_lng !== 'number' ||
      Math.abs(home_lat) > 90 || Math.abs(home_lng) > 180) return bad(res, '坐标无效');
  db.prepare('UPDATE users SET home_name = ?, home_lat = ?, home_lng = ? WHERE id = ?')
    .run(home_name, home_lat, home_lng, req.auth.userId);
  const u = db.prepare('SELECT username, email, home_name, home_lat, home_lng, avatar FROM users WHERE id = ?').get(req.auth.userId);
  res.json({ ...u, avatarUrl: avatarUrl(req.auth.userId, u.avatar) });
});

const AVATAR_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const avatarStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(uploadRoot, 'avatars', String(req.auth.userId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, 'avatar' + (AVATAR_EXT[file.mimetype] || '.jpg'));
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (AVATAR_EXT[file.mimetype]) cb(null, true);
    else cb(new Error('头像仅支持 jpg/png/webp'));
  },
});

router.post('/profile/avatar', requireAuth, requireWrite, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) return bad(res, err.message === 'File too large' ? '头像不能超过 2MB' : err.message);
    if (!req.file) return bad(res, '未收到文件');
    const userId = req.auth.userId;
    const filename = path.basename(req.file.path);
    const prev = db.prepare('SELECT avatar FROM users WHERE id = ?').get(userId);
    // 扩展名变更时删掉旧文件
    if (prev && prev.avatar && prev.avatar !== filename) {
      fs.rmSync(path.join(uploadRoot, 'avatars', String(userId), prev.avatar), { force: true });
    }
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(filename, userId);
    res.json({
      ok: true,
      avatar: filename,
      avatarUrl: avatarUrl(userId, filename) + '?t=' + Date.now(),
    });
  });
});

router.delete('/profile/avatar', requireAuth, requireWrite, (req, res) => {
  const userId = req.auth.userId;
  const prev = db.prepare('SELECT avatar FROM users WHERE id = ?').get(userId);
  if (prev && prev.avatar) {
    fs.rmSync(path.join(uploadRoot, 'avatars', String(userId), prev.avatar), { force: true });
  }
  db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(userId);
  res.json({ ok: true, avatarUrl: null });
});

// ---------- 同行人榜单 ----------
router.get('/companions', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.name, COUNT(*) AS n
    FROM trip_members m JOIN trips t ON t.id = m.trip_id
    WHERE t.user_id = ?
    GROUP BY m.name ORDER BY n DESC, m.name
  `).all(req.auth.userId);
  res.json(rows);
});

// ---------- 旅行项目 ----------
router.get('/trips', requireAuth, (req, res) => {
  const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : null;
  const trips = year
    ? db.prepare('SELECT * FROM trips WHERE user_id = ? AND substr(depart_date, 1, 4) = ? ORDER BY depart_date DESC, id DESC').all(req.auth.userId, year)
    : db.prepare('SELECT * FROM trips WHERE user_id = ? ORDER BY depart_date DESC, id DESC').all(req.auth.userId);
  const result = trips.map((t) => ({
    ...t,
    destinations: listDestinations(t.id),
    memberCount: db.prepare('SELECT COUNT(*) AS n FROM trip_members WHERE trip_id = ?').get(t.id).n,
    spent: round2(db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM trip_expenses WHERE trip_id = ?').get(t.id).s),
    photoCount: db.prepare('SELECT COUNT(*) AS n FROM trip_photos WHERE trip_id = ?').get(t.id).n,
  }));
  res.json(result);
});

function validateTripBody(body) {
  const { title, depart_date, days, transport, distance_km, budget } = body || {};
  if (!title || typeof title !== 'string' || title.length > 50) return 'title 必填且不超过 50 字';
  const dests = normalizeDestinations(body);
  if (dests.error) return dests.error;
  if (!depart_date || !DATE_RE.test(depart_date)) return 'depart_date 必填，格式 YYYY-MM-DD';
  if (!Number.isInteger(days) || days < 1 || days > 365) return 'days 需为 1-365 的整数';
  if (!TRANSPORTS.includes(transport)) return 'transport 需为：' + TRANSPORTS.join('/');
  if (distance_km != null && (typeof distance_km !== 'number' || distance_km < 0)) return 'distance_km 无效';
  if (budget != null && (typeof budget !== 'number' || budget < 0)) return 'budget 无效';
  return null;
}

router.post('/trips', requireAuth, requireWrite, (req, res) => {
  const err = validateTripBody(req.body);
  if (err) return bad(res, err);
  const b = req.body;
  const dests = normalizeDestinations(b);
  const members = Array.isArray(b.members) ? b.members.map((s) => String(s).trim()).filter(Boolean) : [];
  if (!members.length) return bad(res, '至少一名同行人（含自己）');
  if (members.length > 20) return bad(res, '同行人最多 20 人');
  if (new Set(members).size !== members.length) return bad(res, '同行人名字重复');

  const user = db.prepare('SELECT home_name, home_lat, home_lng FROM users WHERE id = ?').get(req.auth.userId);
  const primary = dests[0];
  const destName = formatDestName(dests);
  const r = db.prepare(`INSERT INTO trips
    (user_id, title, origin_name, origin_lat, origin_lng, dest_name, dest_lat, dest_lng,
     depart_date, days, transport, distance_km, budget)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.auth.userId, b.title, user.home_name || null, user.home_lat ?? null, user.home_lng ?? null,
      destName, primary.lat, primary.lng, b.depart_date, b.days, b.transport,
      b.distance_km ?? null, b.budget ?? null);
  const tripId = r.lastInsertRowid;
  replaceDestinations(tripId, dests);
  const ins = db.prepare('INSERT INTO trip_members (trip_id, name) VALUES (?, ?)');
  members.forEach((m) => ins.run(tripId, m));
  dests.forEach((d) => checkinDestination(
    req.auth.userId, b.title, d.name, d.lat, d.lng, d.country, b.depart_date
  ));
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  res.status(201).json({ ...trip, destinations: listDestinations(tripId) });
});

// 发起旅行时自动把目的地记为一次城市打卡（首页统计随之更新）
function checkinDestination(userId, title, destName, destLat, destLng, country, date) {
  let city = db.prepare('SELECT * FROM cities WHERE name = ? AND country = ? AND user_id = ?')
    .get(destName, country, userId);
  if (!city) {
    const r = db.prepare('INSERT INTO cities (user_id, name, country, lat, lng, region) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, destName, country, destLat, destLng, nearestRegion(destLat, destLng, country));
    city = { id: r.lastInsertRowid };
  }
  db.prepare('INSERT INTO visits (city_id, visited_at, note) VALUES (?, ?, ?)')
    .run(city.id, date, `旅行项目：${title}`);
}

function clearTripCheckins(userId, title, date) {
  const visits = db.prepare(`
    SELECT v.id, v.city_id FROM visits v JOIN cities c ON c.id = v.city_id
    WHERE c.user_id = ? AND v.note = ? AND v.visited_at = ?
  `).all(userId, `旅行项目：${title}`, date);
  const cityIds = [...new Set(visits.map((v) => v.city_id))];
  for (const v of visits) {
    db.prepare('DELETE FROM visits WHERE id = ?').run(v.id);
  }
  for (const cityId of cityIds) {
    const left = db.prepare('SELECT COUNT(*) AS n FROM visits WHERE city_id = ?').get(cityId).n;
    if (left === 0) db.prepare('DELETE FROM cities WHERE id = ?').run(cityId);
  }
}

router.get('/trips/:id', requireAuth, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const members = db.prepare('SELECT id, name FROM trip_members WHERE trip_id = ? ORDER BY id').all(trip.id);
  const expenses = db.prepare('SELECT * FROM trip_expenses WHERE trip_id = ? ORDER BY spent_at DESC, id DESC').all(trip.id);
  const itinerary = db.prepare('SELECT * FROM trip_itinerary WHERE trip_id = ? ORDER BY day_no, sort, id').all(trip.id);
  const photos = db.prepare('SELECT id, filename, original_name, created_at FROM trip_photos WHERE trip_id = ? ORDER BY id DESC').all(trip.id);
  const destinations = listDestinations(trip.id);
  res.json({ ...trip, destinations, members, expenses, itinerary, photos, settlement: settle(members, expenses) });
});

router.put('/trips/:id', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const err = validateTripBody(req.body);
  if (err) return bad(res, err);
  const b = req.body;
  const dests = normalizeDestinations(b);
  const primary = dests[0];
  const destName = formatDestName(dests);
  db.prepare(`UPDATE trips SET title=?, dest_name=?, dest_lat=?, dest_lng=?,
    depart_date=?, days=?, transport=?, distance_km=?, budget=? WHERE id=?`)
    .run(b.title, destName, primary.lat, primary.lng, b.depart_date, b.days, b.transport,
      b.distance_km ?? null, b.budget ?? null, trip.id);
  replaceDestinations(trip.id, dests);
  syncCheckin(req.auth.userId, trip, b, dests);
  const updated = db.prepare('SELECT * FROM trips WHERE id = ?').get(trip.id);
  res.json({ ...updated, destinations: listDestinations(trip.id) });
});

// 编辑项目后同步自动打卡：清掉旧打卡，按新目的地列表重建
function syncCheckin(userId, oldTrip, b, dests) {
  clearTripCheckins(userId, oldTrip.title, oldTrip.depart_date);
  dests.forEach((d) => checkinDestination(
    userId, b.title, d.name, d.lat, d.lng, d.country, b.depart_date
  ));
}

router.delete('/trips/:id', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  db.prepare('DELETE FROM trips WHERE id = ?').run(trip.id);
  fs.rmSync(path.join(uploadRoot, String(trip.id)), { recursive: true, force: true });
  res.json({ ok: true });
});

// ---------- 同行人 ----------
router.post('/trips/:id/members', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const name = String((req.body || {}).name || '').trim();
  if (!name || name.length > 20) return bad(res, '名字必填且不超过 20 字');
  const dup = db.prepare('SELECT id FROM trip_members WHERE trip_id = ? AND name = ?').get(trip.id, name);
  if (dup) return bad(res, '该成员已存在');
  const r = db.prepare('INSERT INTO trip_members (trip_id, name) VALUES (?, ?)').run(trip.id, name);
  res.status(201).json(db.prepare('SELECT id, name FROM trip_members WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/trips/:id/members/:mid', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const member = findOwnChild('trip_members', Number(req.params.mid), trip.id);
  if (!member) return notFound(res, '成员不存在');
  if (member.name === '我') return bad(res, '我默认同行，不能移除');
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM trip_members WHERE trip_id = ?').get(trip.id).n;
  if (cnt <= 1) return bad(res, '至少保留一名成员');
  const hasExpense = db.prepare('SELECT COUNT(*) AS n FROM trip_expenses WHERE trip_id = ? AND payer = ?').get(trip.id, member.name).n;
  if (hasExpense > 0) return bad(res, `「${member.name}」有 ${hasExpense} 笔花费记录，请先删除或改派`);
  db.prepare('DELETE FROM trip_members WHERE id = ?').run(member.id);
  res.json({ ok: true });
});

// ---------- 花费 ----------
function validateExpense(body) {
  const { payer, amount, spent_at } = body || {};
  if (!payer || typeof payer !== 'string') return 'payer 必填';
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) return 'amount 必须为大于 0 的数字';
  if (!spent_at || !DATE_RE.test(spent_at)) return 'spent_at 必填，格式 YYYY-MM-DD';
  return null;
}

router.post('/trips/:id/expenses', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const err = validateExpense(req.body);
  if (err) return bad(res, err);
  const { payer, amount, category, note, spent_at } = req.body;
  const isMember = db.prepare('SELECT id FROM trip_members WHERE trip_id = ? AND name = ?').get(trip.id, payer);
  if (!isMember) return bad(res, '付款人必须是同行人之一');
  const r = db.prepare('INSERT INTO trip_expenses (trip_id, payer, amount, category, note, spent_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(trip.id, payer, amount, category || null, note || null, spent_at);
  res.status(201).json(db.prepare('SELECT * FROM trip_expenses WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/trips/:id/expenses/:eid', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const expense = findOwnChild('trip_expenses', Number(req.params.eid), trip.id);
  if (!expense) return notFound(res, '花费记录不存在');
  const err = validateExpense(req.body);
  if (err) return bad(res, err);
  const { payer, amount, category, note, spent_at } = req.body;
  const isMember = db.prepare('SELECT id FROM trip_members WHERE trip_id = ? AND name = ?').get(trip.id, payer);
  if (!isMember) return bad(res, '付款人必须是同行人之一');
  db.prepare('UPDATE trip_expenses SET payer=?, amount=?, category=?, note=?, spent_at=? WHERE id=?')
    .run(payer, amount, category || null, note || null, spent_at, expense.id);
  res.json(db.prepare('SELECT * FROM trip_expenses WHERE id = ?').get(expense.id));
});

router.delete('/trips/:id/expenses/:eid', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const expense = findOwnChild('trip_expenses', Number(req.params.eid), trip.id);
  if (!expense) return notFound(res, '花费记录不存在');
  db.prepare('DELETE FROM trip_expenses WHERE id = ?').run(expense.id);
  res.json({ ok: true });
});

// ---------- 行程 ----------
function validateItinerary(body) {
  const { day_no, content } = body || {};
  if (!Number.isInteger(day_no) || day_no < 1 || day_no > 365) return 'day_no 需为 1-365 的整数';
  if (!content || typeof content !== 'string' || !content.trim()) return 'content 必填';
  return null;
}

router.post('/trips/:id/itinerary', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const err = validateItinerary(req.body);
  if (err) return bad(res, err);
  const { day_no, content, sort } = req.body;
  const r = db.prepare('INSERT INTO trip_itinerary (trip_id, day_no, content, sort) VALUES (?, ?, ?, ?)')
    .run(trip.id, day_no, content.trim(), Number.isInteger(sort) ? sort : 0);
  res.status(201).json(db.prepare('SELECT * FROM trip_itinerary WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/trips/:id/itinerary/:iid', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const item = findOwnChild('trip_itinerary', Number(req.params.iid), trip.id);
  if (!item) return notFound(res, '行程项不存在');
  const err = validateItinerary(req.body);
  if (err) return bad(res, err);
  const { day_no, content, sort } = req.body;
  db.prepare('UPDATE trip_itinerary SET day_no=?, content=?, sort=? WHERE id=?')
    .run(day_no, content.trim(), Number.isInteger(sort) ? sort : 0, item.id);
  res.json(db.prepare('SELECT * FROM trip_itinerary WHERE id = ?').get(item.id));
});

router.delete('/trips/:id/itinerary/:iid', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const item = findOwnChild('trip_itinerary', Number(req.params.iid), trip.id);
  if (!item) return notFound(res, '行程项不存在');
  db.prepare('DELETE FROM trip_itinerary WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

// ---------- AI 生成行程（DeepSeek，预览不落地） ----------
router.post('/trips/:id/itinerary/generate', requireAuth, requireWrite, async (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  if (!config.deepseekKey) return bad(res, '未在 config.json 中配置 deepseekKey');

  const members = db.prepare('SELECT name FROM trip_members WHERE trip_id = ? ORDER BY id').all(trip.id)
    .map((m) => m.name).join('、');
  const dests = listDestinations(trip.id);
  const destLabel = dests.length ? dests.map((d) => d.name).join('、') : trip.dest_name;
  const prompt = [
    `为以下旅行生成一份分天的具体行程计划：`,
    `目的地：${destLabel}`,
    `出发日期：${trip.depart_date}，共 ${trip.days} 天`,
    `出行方式：${trip.transport}${trip.distance_km ? `，单程约 ${trip.distance_km} 公里` : ''}`,
    trip.budget ? `总预算：${trip.budget} 元` : null,
    members ? `同行人：${members}` : null,
    `要求：`,
    `1. 每天 3-5 条安排，每条一句话，格式如"上午 游览故宫博物院"`,
    `2. 结合目的地真实景点、美食和交通，安排要现实可行`,
    dests.length > 1 ? `3. 途经多个地点（${destLabel}），合理安排各站停留与转场` : `3. 第 1 天考虑抵达交通，最后 1 天考虑返程`,
    dests.length > 1 ? `4. 第 1 天考虑抵达交通，最后 1 天考虑返程` : null,
    `${dests.length > 1 ? '5' : '4'}. 只输出 JSON，格式：{"items":[{"day_no":1,"content":"..."}]}，day_no 从 1 到 ${trip.days}`,
  ].filter(Boolean).join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.deepseekKey}`,
      },
      body: JSON.stringify({
        model: config.deepseekModel || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是旅行规划助手，只输出合法 JSON，不要输出任何其他文字。' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    if (!r.ok) {
      console.error('DeepSeek 错误:', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: `AI 服务返回错误 (${r.status})，请检查 deepseekKey` });
    }
    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map((it) => ({ day_no: Number(it.day_no), content: String(it.content || '').trim() }))
      .filter((it) => Number.isInteger(it.day_no) && it.day_no >= 1 && it.day_no <= trip.days && it.content)
      .slice(0, trip.days * 8);
    if (!items.length) return res.status(502).json({ error: 'AI 返回的内容无法解析，请重试' });
    items.sort((a, b) => a.day_no - b.day_no);
    res.json({ items });
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'AI 生成超时，请重试' });
    console.error('AI 生成失败:', e.message);
    res.status(502).json({ error: 'AI 生成失败：' + e.message });
  } finally {
    clearTimeout(timer);
  }
});

// 批量采用行程（mode=replace 先清空已有行程）
router.post('/trips/:id/itinerary/bulk', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const { items, mode } = req.body || {};
  if (!Array.isArray(items) || !items.length) return bad(res, 'items 不能为空');
  const valid = items
    .map((it) => ({ day_no: Number(it.day_no), content: String(it.content || '').trim() }))
    .filter((it) => Number.isInteger(it.day_no) && it.day_no >= 1 && it.day_no <= 365 && it.content && it.content.length <= 200);
  if (!valid.length) return bad(res, 'items 格式无效');
  if (mode === 'replace') db.prepare('DELETE FROM trip_itinerary WHERE trip_id = ?').run(trip.id);
  const ins = db.prepare('INSERT INTO trip_itinerary (trip_id, day_no, content, sort) VALUES (?, ?, ?, ?)');
  valid.forEach((it, idx) => ins.run(trip.id, it.day_no, it.content, idx));
  res.status(201).json(db.prepare('SELECT * FROM trip_itinerary WHERE trip_id = ? ORDER BY day_no, sort, id').all(trip.id));
});

// ---------- 照片 ----------
const ALLOWED_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(uploadRoot, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, crypto.randomBytes(12).toString('hex') + (ALLOWED_EXT[file.mimetype] || '.jpg'));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 9 },
  fileFilter(req, file, cb) {
    if (ALLOWED_EXT[file.mimetype]) cb(null, true);
    else cb(new Error('仅支持 jpg/png/webp/gif 图片'));
  },
});

router.post('/trips/:id/photos', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  upload.array('photos', 9)(req, res, (err) => {
    if (err) return bad(res, err.message === 'File too large' ? '单张照片不能超过 10MB' : err.message);
    if (!req.files || !req.files.length) return bad(res, '未收到文件');
    const ins = db.prepare('INSERT INTO trip_photos (trip_id, filename, original_name) VALUES (?, ?, ?)');
    const saved = req.files.map((f) => {
      const r = ins.run(trip.id, path.basename(f.path), f.originalname);
      return db.prepare('SELECT id, filename, original_name, created_at FROM trip_photos WHERE id = ?').get(r.lastInsertRowid);
    });
    res.status(201).json(saved);
  });
});

router.delete('/trips/:id/photos/:pid', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const photo = findOwnChild('trip_photos', Number(req.params.pid), trip.id);
  if (!photo) return notFound(res, '照片不存在');
  db.prepare('DELETE FROM trip_photos WHERE id = ?').run(photo.id);
  fs.rmSync(path.join(uploadRoot, String(trip.id), photo.filename), { force: true });
  res.json({ ok: true });
});

// ---------- 分享（公开只读链接） ----------
function shareUrl(req, token) {
  const pathPart = `/s/${token}`;
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return pathPart;
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${host}${pathPart}`;
}

function publicTripPayload(trip) {
  const owner = db.prepare('SELECT username FROM users WHERE id = ?').get(trip.user_id);
  const members = db.prepare('SELECT id, name FROM trip_members WHERE trip_id = ? ORDER BY id').all(trip.id);
  const expenses = db.prepare(
    'SELECT id, payer, amount, category, note, spent_at FROM trip_expenses WHERE trip_id = ? ORDER BY spent_at DESC, id DESC'
  ).all(trip.id);
  const itinerary = db.prepare(
    'SELECT id, day_no, content, sort FROM trip_itinerary WHERE trip_id = ? ORDER BY day_no, sort, id'
  ).all(trip.id);
  const photos = db.prepare(
    'SELECT id, filename, original_name, created_at FROM trip_photos WHERE trip_id = ? ORDER BY id DESC'
  ).all(trip.id);
  const destinations = listDestinations(trip.id);
  return {
    title: trip.title,
    origin_name: trip.origin_name,
    dest_name: trip.dest_name,
    destinations,
    depart_date: trip.depart_date,
    days: trip.days,
    transport: trip.transport,
    distance_km: trip.distance_km,
    budget: trip.budget,
    members: members.map((m) => m.name),
    expenses,
    settlement: settle(members, expenses),
    itinerary,
    photos,
    ownerName: owner ? owner.username : '',
  };
}

function findShareByToken(token) {
  if (!token || typeof token !== 'string' || !/^[a-f0-9]{32,64}$/i.test(token)) return null;
  return db.prepare(`
    SELECT s.token AS share_token, s.created_at AS shared_at, t.*
    FROM trip_shares s
    JOIN trips t ON t.id = s.trip_id
    WHERE s.token = ?
  `).get(token);
}

router.get('/trips/:id/share', requireAuth, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  const row = db.prepare('SELECT token, created_at FROM trip_shares WHERE trip_id = ?').get(trip.id);
  if (!row) return res.json({ enabled: false, token: null, url: null });
  res.json({ enabled: true, token: row.token, url: shareUrl(req, row.token), created_at: row.created_at });
});

router.post('/trips/:id/share', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  let row = db.prepare('SELECT token, created_at FROM trip_shares WHERE trip_id = ?').get(trip.id);
  if (!row) {
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO trip_shares (token, trip_id) VALUES (?, ?)').run(token, trip.id);
    row = db.prepare('SELECT token, created_at FROM trip_shares WHERE trip_id = ?').get(trip.id);
  }
  res.json({ enabled: true, token: row.token, url: shareUrl(req, row.token), created_at: row.created_at });
});

router.delete('/trips/:id/share', requireAuth, requireWrite, (req, res) => {
  const trip = findOwnTrip(Number(req.params.id), req.auth.userId);
  if (!trip) return notFound(res, '旅行项目不存在');
  db.prepare('DELETE FROM trip_shares WHERE trip_id = ?').run(trip.id);
  res.json({ ok: true, enabled: false });
});

router.get('/share/:token', (req, res) => {
  const row = findShareByToken(req.params.token);
  if (!row) return notFound(res, '分享不存在或已关闭');
  const { share_token, shared_at, ...trip } = row;
  res.json({ ...publicTripPayload(trip), token: share_token, shared_at });
});

router.get('/share/:token/photos/:filename', (req, res) => {
  const row = findShareByToken(req.params.token);
  if (!row) return notFound(res, '分享不存在或已关闭');
  const filename = path.basename(String(req.params.filename || ''));
  if (!filename || filename !== req.params.filename) return bad(res, '文件名无效');
  const photo = db.prepare(
    'SELECT id FROM trip_photos WHERE trip_id = ? AND filename = ?'
  ).get(row.id, filename);
  if (!photo) return notFound(res, '照片不存在');
  const filePath = path.join(uploadRoot, String(row.id), filename);
  if (!fs.existsSync(filePath)) return notFound(res, '照片文件不存在');
  res.sendFile(filePath);
});

module.exports = router;
