const db = require('../db');

const insertStmt = db.prepare(`
  INSERT INTO clickstream
    (user_id, event_context, component, event_name, description, origin, ip_address, course_id, module_id, meta_json)
  VALUES
    (@user_id, @event_context, @component, @event_name, @description, @origin, @ip_address, @course_id, @module_id, @meta_json)
`);

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Record one clickstream / activity log event.
 * @param {object} req - express request (used for IP address)
 * @param {object} evt
 * @param {number|null} evt.user_id
 * @param {string} evt.event_context - e.g. "Course: ET 610-2024-1 ..." or "System"
 * @param {string} evt.component - e.g. "System", "Logs", "Video", "Quiz", "Forum"
 * @param {string} evt.event_name - e.g. "Course viewed"
 * @param {string} evt.description - human readable description
 * @param {string} [evt.origin] - web | ws | mobile
 * @param {number} [evt.course_id]
 * @param {number} [evt.module_id]
 * @param {object} [evt.meta]
 */
function logEvent(req, evt) {
  insertStmt.run({
    user_id: evt.user_id ?? null,
    event_context: evt.event_context || 'System',
    component: evt.component || 'System',
    event_name: evt.event_name,
    description: evt.description,
    origin: evt.origin || 'web',
    ip_address: getClientIp(req),
    course_id: evt.course_id ?? null,
    module_id: evt.module_id ?? null,
    meta_json: evt.meta ? JSON.stringify(evt.meta) : null,
  });
}

module.exports = { logEvent, getClientIp };
