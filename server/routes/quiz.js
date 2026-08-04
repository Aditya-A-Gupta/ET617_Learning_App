const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logEvent } = require('../lib/clickstream');

const router = express.Router();

// POST /api/quiz/:quizId/submit  { answers: [selectedIndex, ...] }
router.post('/:quizId/submit', requireAuth, (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(quiz.module_id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(module.course_id);

  const questions = db.prepare(
    'SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index'
  ).all(quiz.id);

  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  let correctCount = 0;
  const detail = questions.map((q, idx) => {
    const chosen = answers[idx];
    const correct = chosen === q.correct_index;
    if (correct) correctCount += 1;
    return { question_id: q.id, chosen, correct_index: q.correct_index, correct };
  });

  const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const passed = score >= quiz.pass_score ? 1 : 0;

  db.prepare(`
    INSERT INTO quiz_attempts (user_id, quiz_id, answers_json, score, passed)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, quiz.id, JSON.stringify(answers), score, passed);

  db.prepare(`
    INSERT INTO module_progress (user_id, module_id, status)
    VALUES (?, ?, 'completed')
    ON CONFLICT(user_id, module_id) DO UPDATE SET status = 'completed', updated_at = datetime('now')
  `).run(req.user.id, module.id);

  logEvent(req, {
    user_id: req.user.id,
    event_context: `Course: ${course.code} ${course.title}`,
    component: 'Quiz',
    event_name: 'Quiz attempt submitted',
    description: `The user with id '${req.user.id}' submitted an attempt for quiz '${quiz.title}' (id '${quiz.id}') scoring ${score}%.`,
    course_id: course.id,
    module_id: module.id,
    meta: { score, passed: !!passed },
  });

  res.json({ score, passed: !!passed, pass_score: quiz.pass_score, detail });
});

// Learner's past attempts for a quiz
router.get('/:quizId/attempts', requireAuth, (req, res) => {
  const attempts = db.prepare(
    'SELECT id, score, passed, submitted_at FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY submitted_at DESC'
  ).all(req.user.id, req.params.quizId);
  res.json({ attempts });
});

module.exports = router;
