const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logEvent } = require('../lib/clickstream');

const router = express.Router();

// List courses the learner is enrolled in (admins see all courses)
router.get('/', requireAuth, (req, res) => {
  let courses;
  if (req.user.role === 'admin') {
    courses = db.prepare('SELECT * FROM courses ORDER BY id').all();
  } else {
    courses = db.prepare(`
      SELECT c.* FROM courses c
      JOIN enrollments e ON e.course_id = c.id
      WHERE e.user_id = ?
      ORDER BY c.id
    `).all(req.user.id);
  }

  const bookmarkRows = db.prepare('SELECT course_id FROM bookmarks WHERE user_id = ?').all(req.user.id);
  const bookmarked = new Set(bookmarkRows.map(r => r.course_id));

  courses.forEach(c => {
    const totalModules = db.prepare('SELECT COUNT(*) AS n FROM modules WHERE course_id = ?').get(c.id).n;
    const completedModules = db.prepare(`
      SELECT COUNT(*) AS n FROM module_progress mp
      JOIN modules m ON m.id = mp.module_id
      WHERE mp.user_id = ? AND m.course_id = ? AND mp.status = 'completed'
    `).get(req.user.id, c.id).n;
    c.progress_pct = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;
    c.bookmarked = bookmarked.has(c.id);
    const avgRating = db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM course_ratings WHERE course_id = ?').get(c.id);
    c.avg_rating = avgRating.n ? Math.round(avgRating.avg * 10) / 10 : null;
  });

  res.json({ courses });
});

function courseContext(course) {
  return `Course: ${course.code} ${course.title}`;
}

// Course detail + module list
router.get('/:id', requireAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  if (req.user.role !== 'admin') {
    const enrolled = db.prepare(
      'SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?'
    ).get(req.user.id, course.id);
    if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this course' });
  }

  const modules = db.prepare(
    'SELECT id, order_index, type, title FROM modules WHERE course_id = ? ORDER BY order_index'
  ).all(course.id);

  const progress = db.prepare(
    `SELECT module_id, status FROM module_progress WHERE user_id = ? AND module_id IN (
       SELECT id FROM modules WHERE course_id = ?
     )`
  ).all(req.user.id, course.id);
  const progressMap = Object.fromEntries(progress.map(p => [p.module_id, p.status]));
  modules.forEach(m => { m.status = progressMap[m.id] || 'not_started'; });

  logEvent(req, {
    user_id: req.user.id,
    event_context: courseContext(course),
    component: 'System',
    event_name: 'Course viewed',
    description: `The user with id '${req.user.id}' viewed the course with id '${course.id}'.`,
    course_id: course.id,
  });

  const bookmarked = !!db.prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  const myRating = db.prepare('SELECT rating FROM course_ratings WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  const allComplete = modules.length > 0 && modules.every(m => m.status === 'completed');

  res.json({ course, modules, bookmarked, my_rating: myRating ? myRating.rating : null, all_complete: allComplete });
});

// Toggle bookmark on/off for a course
router.post('/:id/bookmark', requireAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const existing = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  let bookmarked;
  if (existing) {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id);
    bookmarked = false;
  } else {
    db.prepare('INSERT INTO bookmarks (user_id, course_id) VALUES (?, ?)').run(req.user.id, course.id);
    bookmarked = true;
  }

  logEvent(req, {
    user_id: req.user.id,
    event_context: courseContext(course),
    component: 'System',
    event_name: bookmarked ? 'Course bookmarked' : 'Course unbookmarked',
    description: `The user with id '${req.user.id}' ${bookmarked ? 'bookmarked' : 'removed the bookmark from'} the course with id '${course.id}'.`,
    course_id: course.id,
  });

  res.json({ bookmarked });
});

// Rate a course 1-5
router.post('/:id/rate', requireAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be an integer from 1 to 5' });
  }

  db.prepare(`
    INSERT INTO course_ratings (user_id, course_id, rating) VALUES (?, ?, ?)
    ON CONFLICT(user_id, course_id) DO UPDATE SET rating = excluded.rating, created_at = datetime('now')
  `).run(req.user.id, course.id, rating);

  logEvent(req, {
    user_id: req.user.id,
    event_context: courseContext(course),
    component: 'System',
    event_name: 'Course rated',
    description: `The user with id '${req.user.id}' rated the course with id '${course.id}' ${rating} out of 5 stars.`,
    course_id: course.id,
    meta: { rating },
  });

  res.json({ ok: true, rating });
});

// Single module content (text/video/quiz)
router.get('/:courseId/modules/:moduleId', requireAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const module = db.prepare(
    'SELECT * FROM modules WHERE id = ? AND course_id = ?'
  ).get(req.params.moduleId, course.id);
  if (!module) return res.status(404).json({ error: 'Module not found' });

  let quiz = null;
  if (module.type === 'quiz') {
    const q = db.prepare('SELECT id, title, pass_score FROM quizzes WHERE module_id = ?').get(module.id);
    if (q) {
      const questions = db.prepare(
        'SELECT id, order_index, question_text, options_json FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index'
      ).all(q.id).map(qq => ({
        id: qq.id,
        order_index: qq.order_index,
        question_text: qq.question_text,
        options: JSON.parse(qq.options_json),
      }));
      quiz = { ...q, questions };
    }
  }

  db.prepare(`
    INSERT INTO module_progress (user_id, module_id, status)
    VALUES (?, ?, 'in_progress')
    ON CONFLICT(user_id, module_id) DO UPDATE SET updated_at = datetime('now')
  `).run(req.user.id, module.id);

  const componentByType = { text: 'Page', video: 'Video', quiz: 'Quiz', mixed: 'Page' };
  logEvent(req, {
    user_id: req.user.id,
    event_context: courseContext(course),
    component: componentByType[module.type] || 'Page',
    event_name: 'Course module viewed',
    description: `The user with id '${req.user.id}' viewed the '${module.type}' module '${module.title}' (id '${module.id}') in the course with id '${course.id}'.`,
    course_id: course.id,
    module_id: module.id,
  });

  const noteRow = db.prepare('SELECT note_text FROM module_notes WHERE user_id = ? AND module_id = ?').get(req.user.id, module.id);

  res.json({ module, quiz, note: noteRow ? noteRow.note_text : '' });
});

// Save/update a learner's personal note on a module
router.post('/:courseId/modules/:moduleId/note', requireAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  const module = db.prepare('SELECT * FROM modules WHERE id = ? AND course_id = ?')
    .get(req.params.moduleId, req.params.courseId);
  if (!course || !module) return res.status(404).json({ error: 'Not found' });

  const note_text = String(req.body?.note_text || '').slice(0, 4000);

  if (!note_text.trim()) {
    db.prepare('DELETE FROM module_notes WHERE user_id = ? AND module_id = ?').run(req.user.id, module.id);
  } else {
    db.prepare(`
      INSERT INTO module_notes (user_id, module_id, note_text) VALUES (?, ?, ?)
      ON CONFLICT(user_id, module_id) DO UPDATE SET note_text = excluded.note_text, updated_at = datetime('now')
    `).run(req.user.id, module.id, note_text);
  }

  logEvent(req, {
    user_id: req.user.id,
    event_context: courseContext(course),
    component: 'Page',
    event_name: 'Module note saved',
    description: `The user with id '${req.user.id}' saved a personal note on module '${module.title}' (id '${module.id}').`,
    course_id: course.id,
    module_id: module.id,
  });

  res.json({ ok: true });
});

// Mark a text/video module as completed (explicit learner action)
router.post('/:courseId/modules/:moduleId/complete', requireAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  const module = db.prepare('SELECT * FROM modules WHERE id = ? AND course_id = ?')
    .get(req.params.moduleId, req.params.courseId);
  if (!course || !module) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    INSERT INTO module_progress (user_id, module_id, status)
    VALUES (?, ?, 'completed')
    ON CONFLICT(user_id, module_id) DO UPDATE SET status = 'completed', updated_at = datetime('now')
  `).run(req.user.id, module.id);

  logEvent(req, {
    user_id: req.user.id,
    event_context: courseContext(course),
    component: module.type === 'video' ? 'Video' : 'Page',
    event_name: 'Course module completed',
    description: `The user with id '${req.user.id}' marked module '${module.title}' (id '${module.id}') as completed.`,
    course_id: course.id,
    module_id: module.id,
  });

  res.json({ ok: true });
});

module.exports = router;
