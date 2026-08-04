const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { logEvent } = require('../lib/clickstream');

const router = express.Router();

// Whitelist of event names the client is allowed to emit directly, mapped to
// a component label, so a malicious client can't inject arbitrary log rows.
const ALLOWED_EVENTS = {
  'ui_click': 'UI',
  'video_played': 'Video',
  'video_paused': 'Video',
  'video_seeked': 'Video',
  'video_ended': 'Video',
  'video_progress_25': 'Video',
  'video_progress_50': 'Video',
  'video_progress_75': 'Video',
  'quiz_started': 'Quiz',
  'quiz_option_selected': 'Quiz',
  'dashboard_viewed': 'System',
  'page_viewed': 'Page',
  'courses_searched': 'System',
  'courses_sorted': 'System',
  'theme_toggled': 'UI',
  'certificate_downloaded': 'System',
  'admin_log_load_more': 'Logs',
  'admin_log_filtered': 'Logs',
};

router.post('/', optionalAuth, (req, res) => {
  const { event_name, description, course_id, module_id, event_context, meta, origin } = req.body || {};

  if (!event_name || !ALLOWED_EVENTS[event_name]) {
    return res.status(400).json({ error: 'Unknown or missing event_name' });
  }

  let course = null;
  if (course_id) course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);

  logEvent(req, {
    user_id: req.user ? req.user.id : null,
    event_context: event_context || (course ? `Course: ${course.code} ${course.title}` : 'System'),
    component: ALLOWED_EVENTS[event_name],
    event_name,
    description: description || `Client event '${event_name}' recorded.`,
    origin: origin === 'mobile' ? 'mobile' : 'web',
    course_id: course_id || null,
    module_id: module_id || null,
    meta,
  });

  res.status(201).json({ ok: true });
});

module.exports = router;
