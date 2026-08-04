const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

function formatTime(iso) {
  // Convert 'YYYY-MM-DD HH:MM:SS' (UTC, from SQLite datetime('now')) to
  // 'D/M/YY, HH:MM:SS' to mirror the example log format.
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  const dd = d.getUTCDate();
  const mm = d.getUTCMonth() + 1;
  const yy = String(d.getUTCFullYear()).slice(-2);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yy}, ${hh}:${min}:${ss}`;
}

// Paginated / filterable clickstream log, newest first
router.get('/clickstream', (req, res) => {
  const { course_id, user_id, component, limit = 100, offset = 0 } = req.query;
  const clauses = [];
  const params = {};
  if (course_id) { clauses.push('cs.course_id = @course_id'); params.course_id = course_id; }
  if (user_id) { clauses.push('cs.user_id = @user_id'); params.user_id = user_id; }
  if (component) { clauses.push('cs.component = @component'); params.component = component; }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

  params.limit = Number(limit);
  params.offset = Number(offset);

  const rows = db.prepare(`
    SELECT cs.*, u.username, u.full_name
    FROM clickstream cs
    LEFT JOIN users u ON u.id = cs.user_id
    ${where}
    ORDER BY cs.event_time DESC, cs.id DESC
    LIMIT @limit OFFSET @offset
  `).all(params);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM clickstream cs ${where}`).get(params).n;

  const events = rows.map(r => ({
    id: r.id,
    time: formatTime(r.event_time),
    event_context: r.event_context,
    component: r.component,
    event_name: r.event_name,
    description: r.description,
    origin: r.origin,
    ip_address: r.ip_address,
    user: r.username ? { username: r.username, full_name: r.full_name } : null,
    course_id: r.course_id,
  }));

  res.json({ total, events });
});

// CSV export matching the example columns exactly
router.get('/clickstream/export.csv', (req, res) => {
  const rows = db.prepare(`
    SELECT cs.* FROM clickstream cs ORDER BY cs.event_time DESC, cs.id DESC
  `).all();

  const header = ['Time', 'Event context', 'Component', 'Event name', 'Description', 'Origin', 'IP address'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      formatTime(r.event_time), r.event_context, r.component, r.event_name,
      r.description, r.origin, r.ip_address,
    ].map(esc).join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="clickstream_export.csv"');
  res.send(lines.join('\n'));
});

// Summary stats for a dashboard: event counts, active users, per-course activity
router.get('/stats', (req, res) => {
  const totalEvents = db.prepare('SELECT COUNT(*) AS n FROM clickstream').get().n;
  const totalUsers = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'learner'").get().n;
  const totalCourses = db.prepare('SELECT COUNT(*) AS n FROM courses').get().n;
  const totalQuizAttempts = db.prepare('SELECT COUNT(*) AS n FROM quiz_attempts').get().n;

  const byComponent = db.prepare(`
    SELECT component, COUNT(*) AS n FROM clickstream GROUP BY component ORDER BY n DESC
  `).all();

  const byEventName = db.prepare(`
    SELECT event_name, COUNT(*) AS n FROM clickstream GROUP BY event_name ORDER BY n DESC LIMIT 10
  `).all();

  const mostActiveUsers = db.prepare(`
    SELECT u.id, u.username, u.full_name, COUNT(*) AS n
    FROM clickstream cs JOIN users u ON u.id = cs.user_id
    GROUP BY u.id ORDER BY n DESC LIMIT 10
  `).all();

  const perCourse = db.prepare(`
    SELECT c.id, c.title, COUNT(cs.id) AS n
    FROM courses c LEFT JOIN clickstream cs ON cs.course_id = c.id
    GROUP BY c.id ORDER BY n DESC
  `).all();

  const quizPassRate = db.prepare(`
    SELECT
      SUM(passed) AS passed,
      COUNT(*) AS total
    FROM quiz_attempts
  `).get();

  res.json({
    totalEvents, totalUsers, totalCourses, totalQuizAttempts,
    byComponent, byEventName, mostActiveUsers, perCourse, quizPassRate,
  });
});

module.exports = router;
