const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth, optionalAuth, COOKIE_NAME } = require('../middleware/auth');
const { logEvent } = require('../lib/clickstream');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 12 * 60 * 60 * 1000,
};

router.post('/register', (req, res) => {
  const { username, password, full_name } = req.body || {};
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'username, password and full_name are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const hash = bcrypt.hashSync(password, 8);
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  ).run(username, hash, full_name, 'learner');

  const user = { id: info.lastInsertRowid, username, full_name, role: 'learner' };
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

  logEvent(req, {
    user_id: user.id,
    event_context: 'System',
    component: 'Auth',
    event_name: 'User registered',
    description: `The user with id '${user.id}' created a new learner account ('${username}').`,
  });

  res.json({ user });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    logEvent(req, {
      user_id: null,
      event_context: 'System',
      component: 'Auth',
      event_name: 'Login failed',
      description: `A failed login attempt was made for username '${username}'.`,
    });
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const user = { id: row.id, username: row.username, full_name: row.full_name, role: row.role };
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

  logEvent(req, {
    user_id: user.id,
    event_context: 'System',
    component: 'Auth',
    event_name: 'User loggedin',
    description: `The user with id '${user.id}' logged in.`,
  });

  res.json({ user });
});

router.post('/logout', optionalAuth, (req, res) => {
  if (req.user) {
    logEvent(req, {
      user_id: req.user.id,
      event_context: 'System',
      component: 'Auth',
      event_name: 'User loggedout',
      description: `The user with id '${req.user.id}' logged out.`,
    });
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
