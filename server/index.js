import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { products } from '../shared/catalog.js';
import { defaultSiteSettings } from '../shared/siteSettings.js';

const scrypt = promisify(scryptCallback);
const app = express();
const port = Number(process.env.API_PORT || 3001);
const sessionDurationSeconds = 60 * 60 * 24 * 14;
const databasePath = path.resolve(process.env.DATABASE_PATH || 'data/asad-topup.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    package_name TEXT NOT NULL,
    player_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders(user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS admins (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES admins(username) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    kind TEXT NOT NULL,
    note TEXT NOT NULL,
    order_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON wallet_transactions(user_id, created_at DESC);
`);
function ensureColumn(table, column, definition) {
  const existing = database.pragma(`table_info(${table})`).some((item) => item.name === column);
  if (!existing) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('users', 'wallet_balance', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'name', "TEXT NOT NULL DEFAULT ''");
database.prepare("UPDATE users SET name = substr(email, 1, instr(email, '@') - 1) WHERE name = ''").run();
ensureColumn('orders', 'payment_method', "TEXT NOT NULL DEFAULT 'manual'");
ensureColumn('orders', 'payment_status', "TEXT NOT NULL DEFAULT 'unpaid'");
database.prepare('INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)').run('catalog', JSON.stringify(products));
database.prepare('INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)').run('site-content', JSON.stringify(defaultSiteSettings));
database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
database.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
}));
app.use(express.json({ limit: '16kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const getUserById = database.prepare('SELECT id, name, email, created_at AS createdAt, wallet_balance AS walletBalance FROM users WHERE id = ?');
const insertSession = database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
const deleteSession = database.prepare('DELETE FROM sessions WHERE token_hash = ?');
const getSessionUser = database.prepare(`
  SELECT users.id, users.name, users.email, users.created_at AS createdAt,
    users.wallet_balance AS walletBalance, sessions.token_hash AS tokenHash
  FROM sessions JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ? AND sessions.expires_at > ?
`);

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(request, name) {
  const prefix = `${name}=`;
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : null;
}

function setSessionCookie(response, token, maxAge = sessionDurationSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `asad_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`);
}

function createSession(response, userId) {
  const token = randomBytes(32).toString('hex');
  insertSession.run(hashToken(token), userId, Date.now() + sessionDurationSeconds * 1000);
  setSessionCookie(response, token);
}

async function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
  throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD before starting in production.');
}
const adminUsername = (process.env.ADMIN_USERNAME || 'asad').trim();
const adminPassword = process.env.ADMIN_PASSWORD || 'Asad0130';
if (!database.prepare('SELECT username FROM admins WHERE username = ?').get(adminUsername)) {
  const passwordHash = await createPasswordHash(adminPassword);
  database.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(adminUsername, passwordHash);
}

function readAdminCookie(request) {
  return readCookie(request, 'asad_admin');
}

function setAdminCookie(response, token, maxAge = sessionDurationSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `asad_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`);
}

function requireAdmin(request, response, next) {
  const token = readAdminCookie(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return response.status(401).json({ error: 'Admin sign-in required.' });
  const session = database.prepare(`SELECT admins.username, admin_sessions.token_hash AS tokenHash
    FROM admin_sessions JOIN admins ON admins.username = admin_sessions.username
    WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > ?`).get(hashToken(token), Date.now());
  if (!session) {
    setAdminCookie(response, '', 0);
    return response.status(401).json({ error: 'Admin session expired. Please sign in again.' });
  }
  request.admin = { username: session.username };
  request.adminSessionTokenHash = session.tokenHash;
  next();
}

function getCatalog() {
  const row = database.prepare('SELECT value FROM site_config WHERE key = ?').get('catalog');
  try { return row ? JSON.parse(row.value) : products; } catch { return products; }
}

function getSiteSettings() {
  const row = database.prepare('SELECT value FROM site_config WHERE key = ?').get('site-content');
  try { return row ? { ...defaultSiteSettings, ...JSON.parse(row.value) } : defaultSiteSettings; }
  catch { return defaultSiteSettings; }
}

function requireUser(request, response, next) {
  const token = readCookie(request, 'asad_session');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return response.status(401).json({ error: 'Sign in to continue.' });
  }
  const session = getSessionUser.get(hashToken(token), Date.now());
  if (!session) {
    setSessionCookie(response, '', 0);
    return response.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
  request.user = { id: session.id, name: session.name, email: session.email, createdAt: session.createdAt, walletBalance: session.walletBalance };
  request.sessionTokenHash = session.tokenHash;
  next();
}

function publicUser(user) {
  return { id: user.id, name: user.name || '', email: user.email, createdAt: user.createdAt, walletBalance: user.walletBalance || 0 };
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.get('/api/catalog', (_request, response) => response.json({ products: getCatalog() }));
app.get('/api/site-settings', (_request, response) => response.json({ settings: getSiteSettings() }));
app.post('/api/admin/login', adminLimiter, async (request, response, next) => {
  try {
    const username = typeof request.body.username === 'string' ? request.body.username.trim() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const admin = database.prepare('SELECT username, password_hash AS passwordHash FROM admins WHERE username = ?').get(username);
    if (!admin || password.length > 128) return response.status(401).json({ error: 'Username or password is incorrect.' });
    const [salt, storedHash] = admin.passwordHash.split(':');
    const derivedKey = Buffer.from(await scrypt(password, salt, 64));
    const expectedHash = Buffer.from(storedHash, 'hex');
    if (derivedKey.length !== expectedHash.length || !timingSafeEqual(derivedKey, expectedHash)) {
      return response.status(401).json({ error: 'Username or password is incorrect.' });
    }
    const token = randomBytes(32).toString('hex');
    database.prepare('INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES (?, ?, ?)')
      .run(hashToken(token), admin.username, Date.now() + sessionDurationSeconds * 1000);
    setAdminCookie(response, token);
    response.json({ admin: { username: admin.username } });
  } catch (error) { next(error); }
});
app.get('/api/admin/me', requireAdmin, (request, response) => response.json({ admin: request.admin }));
app.post('/api/admin/logout', (request, response) => {
  const token = readAdminCookie(request);
  if (token && /^[a-f0-9]{64}$/.test(token)) database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token));
  setAdminCookie(response, '', 0);
  response.status(204).end();
});
app.get('/api/admin/overview', requireAdmin, (request, response) => {
  const orders = database.prepare(`SELECT orders.id, orders.user_id AS userId, users.name AS customerName, users.email,
    orders.product_id AS productId, orders.product_name AS productName, orders.package_name AS packageName,
    orders.player_id AS playerId, orders.amount, orders.status,
    orders.payment_method AS paymentMethod, orders.payment_status AS paymentStatus,
    orders.created_at AS createdAt
    FROM orders JOIN users ON users.id = orders.user_id ORDER BY orders.created_at DESC, orders.rowid DESC`).all();
  const customers = database.prepare(`SELECT users.id, users.name, users.email, users.created_at AS createdAt,
    users.wallet_balance AS walletBalance,
    COUNT(orders.id) AS orderCount, COALESCE(SUM(CASE WHEN orders.status = 'completed' THEN orders.amount ELSE 0 END), 0) AS completedTotal
    FROM users LEFT JOIN orders ON orders.user_id = users.id GROUP BY users.id ORDER BY users.created_at DESC`).all();
  const stats = {
    customers: customers.length,
    orders: orders.length,
    active: orders.filter((order) => order.status === 'pending' || order.status === 'processing').length,
    completedTotal: orders.filter((order) => order.status === 'completed').reduce((sum, order) => sum + order.amount, 0),
    walletLiability: customers.reduce((sum, customer) => sum + customer.walletBalance, 0),
  };
  response.json({ stats, orders, customers, products: getCatalog(), admin: request.admin });
});
app.post('/api/admin/customers/:id/wallet', requireAdmin, (request, response) => {
  const { amount, note } = request.body;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) {
    return response.status(400).json({ error: 'Enter a credit amount from 1 to 100,000,000 BDT.' });
  }
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 200) : 'Admin wallet credit';
  const customer = database.prepare('SELECT id, wallet_balance AS walletBalance FROM users WHERE id = ?').get(request.params.id);
  if (!customer) return response.status(404).json({ error: 'Customer not found.' });
  const credit = database.transaction(() => {
    database.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(amount, customer.id);
    database.prepare(`INSERT INTO wallet_transactions (id, user_id, amount, kind, note)
      VALUES (?, ?, ?, 'admin_credit', ?)`).run(randomBytes(12).toString('hex'), customer.id, amount, cleanNote || 'Admin wallet credit');
    return database.prepare('SELECT wallet_balance AS walletBalance FROM users WHERE id = ?').get(customer.id);
  });
  response.json({ walletBalance: credit().walletBalance });
});
app.patch('/api/admin/orders/:id', requireAdmin, (request, response) => {
  const allowedStatuses = ['pending', 'processing', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(request.body.status)) return response.status(400).json({ error: 'Choose a valid order status.' });
  const update = database.transaction(() => {
    const order = database.prepare('SELECT id, user_id AS userId, amount, payment_method AS paymentMethod, payment_status AS paymentStatus FROM orders WHERE id = ?').get(request.params.id);
    if (!order) return false;
    if (request.body.status === 'cancelled' && order.paymentMethod === 'wallet' && order.paymentStatus === 'paid') {
      database.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(order.amount, order.userId);
      database.prepare(`INSERT INTO wallet_transactions (id, user_id, amount, kind, note, order_id)
        VALUES (?, ?, ?, 'refund', ?, ?)`).run(randomBytes(12).toString('hex'), order.userId, order.amount, `Refund for cancelled order #${order.id.slice(0, 8)}`, order.id);
      database.prepare("UPDATE orders SET status = ?, payment_status = 'refunded' WHERE id = ?").run(request.body.status, order.id);
    } else {
      database.prepare('UPDATE orders SET status = ? WHERE id = ?').run(request.body.status, order.id);
    }
    return true;
  });
  if (!update()) return response.status(404).json({ error: 'Order not found.' });
  response.json({ ok: true });
});
app.put('/api/admin/catalog', requireAdmin, (request, response) => {
  const catalog = request.body.products;
  if (!Array.isArray(catalog) || catalog.length > 100) return response.status(400).json({ error: 'Catalog must contain a valid product list.' });
  const ids = new Set();
  for (const product of catalog) {
    if (!product || typeof product.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(product.id) || ids.has(product.id) ||
      typeof product.name !== 'string' || !product.name.trim() || product.name.length > 120 ||
      typeof product.tag !== 'string' || product.tag.length > 40 || typeof product.promo !== 'string' || product.promo.length > 100 ||
      typeof product.label !== 'string' || product.label.length > 60 || !Array.isArray(product.packages) || product.packages.length < 1 || product.packages.length > 100 ||
      product.packages.some((item) => !Array.isArray(item) || typeof item[0] !== 'string' || !item[0].trim() || item[0].length > 100 || !Number.isSafeInteger(item[1]) || item[1] < 0 || item[1] > 100000000)) {
      return response.status(400).json({ error: 'Check product names, IDs, and package prices. At least one valid package is required per product.' });
    }
    ids.add(product.id);
  }
  database.prepare('UPDATE site_config SET value = ? WHERE key = ?').run(JSON.stringify(catalog), 'catalog');
  response.json({ products: catalog });
});
app.put('/api/admin/site-settings', requireAdmin, (request, response) => {
  const settings = request.body.settings;
  const fields = ['brandName', 'locationLabel', 'heroEyebrow', 'heroTitleFirst', 'heroTitleSecond', 'heroDescription', 'heroPrimaryLabel', 'heroSecondaryLabel', 'catalogEyebrow', 'catalogTitle', 'catalogDescription', 'footerDescription'];
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) || fields.some((key) => typeof settings[key] !== 'string' || !settings[key].trim() || settings[key].length > 500)) {
    return response.status(400).json({ error: 'Complete all site text fields (maximum 500 characters each).' });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(settings.accentColor) || !Array.isArray(settings.services) || settings.services.length > 6 || settings.services.some((item) => !item || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 80 || typeof item.description !== 'string' || !item.description.trim() || item.description.length > 160)) {
    return response.status(400).json({ error: 'Choose a valid accent color and check each service highlight.' });
  }
  const safeSettings = Object.fromEntries(fields.map((key) => [key, settings[key].trim()]));
  safeSettings.accentColor = settings.accentColor;
  safeSettings.services = settings.services.map((item) => ({ title: item.title.trim(), description: item.description.trim() }));
  database.prepare('UPDATE site_config SET value = ? WHERE key = ?').run(JSON.stringify(safeSettings), 'site-content');
  response.json({ settings: safeSettings });
});
app.get('/api/auth/me', requireUser, (request, response) => response.json({ user: request.user }));

app.post('/api/auth/register', authLimiter, async (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    if (name.length < 1 || name.length > 80) {
      return response.status(400).json({ error: 'Enter your name (up to 80 characters).' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return response.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (password.length < 8 || password.length > 128) {
      return response.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }
    const id = randomBytes(16).toString('hex');
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scrypt(password, salt, 64);
    const passwordHash = `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
    try {
      database.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(id, name, email, passwordHash);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return response.status(409).json({ error: 'An account with this email already exists.' });
      }
      throw error;
    }
    const user = getUserById.get(id);
    createSession(response, id);
    response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const userRecord = database.prepare('SELECT id, name, email, password_hash, created_at AS createdAt, wallet_balance AS walletBalance FROM users WHERE email = ?').get(email);
    if (!userRecord || password.length > 128) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const [salt, storedHash] = userRecord.password_hash.split(':');
    const derivedKey = Buffer.from(await scrypt(password, salt, 64));
    const expectedHash = Buffer.from(storedHash, 'hex');
    if (derivedKey.length !== expectedHash.length || !timingSafeEqual(derivedKey, expectedHash)) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    const user = publicUser(userRecord);
    createSession(response, user.id);
    response.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', (request, response) => {
  const token = readCookie(request, 'asad_session');
  if (token && /^[a-f0-9]{64}$/.test(token)) deleteSession.run(hashToken(token));
  setSessionCookie(response, '', 0);
  response.status(204).end();
});

app.get('/api/wallet', requireUser, (request, response) => {
  const transactions = database.prepare(`SELECT amount, kind, note, order_id AS orderId, created_at AS createdAt
    FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 25`).all(request.user.id);
  const account = database.prepare('SELECT wallet_balance AS balance FROM users WHERE id = ?').get(request.user.id);
  response.json({ balance: account.balance, transactions });
});

app.get('/api/orders', requireUser, (request, response) => {
  const orders = database.prepare(`
    SELECT id, product_id AS productId, product_name AS productName,
      package_name AS packageName, player_id AS playerId, amount,
      status, payment_method AS paymentMethod, payment_status AS paymentStatus,
      created_at AS createdAt
    FROM orders WHERE user_id = ? ORDER BY created_at DESC, rowid DESC
  `).all(request.user.id);
  response.json({ orders });
});

app.post('/api/orders', requireUser, (request, response) => {
  const { productId, packageName, playerId } = request.body;
  const paymentMethod = request.body.paymentMethod === undefined ? 'manual' : request.body.paymentMethod;
  if (typeof productId !== 'string' || typeof packageName !== 'string' || typeof playerId !== 'string') {
    return response.status(400).json({ error: 'Choose a product, package, and enter your player ID.' });
  }
  if (!['manual', 'wallet', 'bkash_demo'].includes(paymentMethod)) return response.status(400).json({ error: 'Choose a valid payment method.' });
  const cleanPlayerId = playerId.trim();
  if (cleanPlayerId.length < 3 || cleanPlayerId.length > 80) {
    return response.status(400).json({ error: 'Enter a valid player ID (3 to 80 characters).' });
  }
  const product = getCatalog().find((item) => item.id === productId);
  const selectedPackage = product?.packages.find(([name]) => name === packageName);
  if (!product || !selectedPackage) {
    return response.status(400).json({ error: 'That product package is not available.' });
  }
  const order = {
    id: randomBytes(12).toString('hex'),
    productId: product.id,
    productName: product.name,
    packageName: selectedPackage[0],
    playerId: cleanPlayerId,
    amount: selectedPackage[1],
    status: 'processing',
    paymentMethod,
    paymentStatus: paymentMethod === 'wallet' ? 'paid' : paymentMethod === 'bkash_demo' ? 'demo_paid' : 'unpaid',
  };
  const placeOrder = database.transaction(() => {
    let walletBalance = request.user.walletBalance;
    if (paymentMethod === 'wallet') {
      const debit = database.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ? AND wallet_balance >= ?').run(order.amount, request.user.id, order.amount);
      if (!debit.changes) return null;
      walletBalance = database.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(request.user.id).wallet_balance;
      database.prepare(`INSERT INTO wallet_transactions (id, user_id, amount, kind, note, order_id)
        VALUES (?, ?, ?, 'purchase', ?, ?)`).run(randomBytes(12).toString('hex'), request.user.id, -order.amount, `Payment for ${order.productName} · ${order.packageName}`, order.id);
    }
    database.prepare(`
      INSERT INTO orders (id, user_id, product_id, product_name, package_name, player_id, amount, status, payment_method, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(order.id, request.user.id, order.productId, order.productName, order.packageName, order.playerId, order.amount, order.status, order.paymentMethod, order.paymentStatus);
    return walletBalance;
  });
  const walletBalance = placeOrder();
  if (walletBalance === null) return response.status(400).json({ error: 'Your wallet balance is too low. Ask an admin to add funds, or choose manual confirmation.' });
  response.status(201).json({ order: { ...order, walletBalance } });
});

app.use('/api', (_request, response) => response.status(404).json({ error: 'API endpoint not found.' }));

const distDirectory = path.resolve('dist');
if (fs.existsSync(distDirectory)) {
  app.use(express.static(distDirectory));
  app.get(/.*/, (_request, response) => response.sendFile(path.join(distDirectory, 'index.html')));
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Asad Topup listening on port ${port} (available on the local network)`);
});
