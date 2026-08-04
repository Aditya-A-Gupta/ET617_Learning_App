const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logEvent } = require('../lib/clickstream');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id;

  const enrolledCourses = db.prepare(
    'SELECT COUNT(*) AS n FROM enrollments WHERE user_id = ?'
  ).get(userId).n;

  const completedModules = db.prepare(
    "SELECT COUNT(*) AS n FROM module_progress WHERE user_id = ? AND status = 'completed'"
  ).get(userId).n;

  const quizStats = db.prepare(`
    SELECT COUNT(*) AS attempts, SUM(passed) AS passed, AVG(score) AS avg_score
    FROM quiz_attempts WHERE user_id = ?
  `).get(userId);

  const bookmarks = db.prepare(`
    SELECT b.course_id, c.code, c.title FROM bookmarks b
    JOIN courses c ON c.id = b.course_id
    WHERE b.user_id = ?
  `).all(userId);

  const recentActivity = db.prepare(`
    SELECT event_time, event_name, description FROM clickstream
    WHERE user_id = ? ORDER BY event_time DESC, id DESC LIMIT 15
  `).all(userId);

  const totalEvents = db.prepare('SELECT COUNT(*) AS n FROM clickstream WHERE user_id = ?').get(userId).n;

  logEvent(req, {
    user_id: userId,
    event_context: 'System',
    component: 'System',
    event_name: 'Profile viewed',
    description: `The user with id '${userId}' viewed their own profile page.`,
  });

  res.json({
    user: req.user,
    enrolledCourses,
    completedModules,
    quizAttempts: quizStats.attempts || 0,
    quizPassed: quizStats.passed || 0,
    avgQuizScore: quizStats.avg_score ? Math.round(quizStats.avg_score) : 0,
    bookmarks,
    recentActivity,
    totalEvents,
  });
});

module.exports = router;
