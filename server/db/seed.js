// Seeds the database with a demo admin, a demo learner, and one full course
// containing text, video and quiz modules. Safe to re-run (clears tables first).
const bcrypt = require('bcryptjs');
const db = require('./index');

function reset() {
  db.exec(`
    DELETE FROM clickstream;
    DELETE FROM module_progress;
    DELETE FROM quiz_attempts;
    DELETE FROM quiz_questions;
    DELETE FROM quizzes;
    DELETE FROM modules;
    DELETE FROM enrollments;
    DELETE FROM courses;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

function seed() {
  reset();

  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`
  );
  const adminId = insertUser.run(
    'admin', bcrypt.hashSync('admin123', 8), 'Ada Instructor', 'admin'
  ).lastInsertRowid;
  const learnerId = insertUser.run(
    'learner', bcrypt.hashSync('learner123', 8), 'Leo Learner', 'learner'
  ).lastInsertRowid;
  insertUser.run('priya', bcrypt.hashSync('learner123', 8), 'Priya Sharma', 'learner');

  const insertCourse = db.prepare(
    `INSERT INTO courses (code, title, description) VALUES (?, ?, ?)`
  );
  const courseId = insertCourse.run(
    'ET 610-2024-1',
    'Learning Analytics and Educational Data Mining',
    'An introduction to collecting, mining, and interpreting learner activity ' +
    'data (clickstream data) to improve teaching and learning outcomes.'
  ).lastInsertRowid;

  const course2Id = insertCourse.run(
    'CS 101-2024-1',
    'Introduction to Programming',
    'Foundational concepts of programming: variables, control flow, and functions.'
  ).lastInsertRowid;

  db.prepare(`INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)`).run(learnerId, courseId);
  db.prepare(`INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)`).run(learnerId, course2Id);

  const insertModule = db.prepare(`
    INSERT INTO modules (course_id, order_index, type, title, body_html, video_url, video_poster)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // --- Course 1 modules ---
  const m1 = insertModule.run(
    courseId, 1, 'text', 'What is Learning Analytics?',
    `<p><strong>Learning analytics</strong> is the measurement, collection, analysis
     and reporting of data about learners and their contexts, for purposes of
     understanding and optimizing learning and the environments in which it occurs.</p>
     <p>A core data source is <em>clickstream data</em>: a timestamped record of every
     click, page view, video interaction, and quiz attempt a learner makes inside a
     learning platform. Each row typically captures who did what, when, and from
     where &mdash; similar to a server access log.</p>
     <p>In this course you will explore how this data is captured, stored, and used
     to build dashboards, at-risk predictors, and personalized recommendations.</p>`,
    null, null
  ).lastInsertRowid;

  const m2 = insertModule.run(
    courseId, 2, 'video', 'Video: How Clickstream Data is Captured',
    `<p>Watch the short explainer below, then continue to the quiz.</p>`,
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    null
  ).lastInsertRowid;

  const m3 = insertModule.run(
    courseId, 3, 'quiz', 'Quiz: Clickstream Fundamentals',
    null, null, null
  ).lastInsertRowid;

  const quiz1 = db.prepare(
    `INSERT INTO quizzes (module_id, title, pass_score) VALUES (?, ?, ?)`
  ).run(m3, 'Clickstream Fundamentals Quiz', 70).lastInsertRowid;

  const insertQ = db.prepare(`
    INSERT INTO quiz_questions (quiz_id, order_index, question_text, options_json, correct_index)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertQ.run(quiz1, 1, 'What does clickstream data primarily record?',
    JSON.stringify(['User activity events over time', 'Only final grades', 'Server hardware specs', 'Course syllabi']), 0);
  insertQ.run(quiz1, 2, 'Which of these is NOT a typical clickstream field?',
    JSON.stringify(['Event name', 'IP address', 'Timestamp', 'Student blood type']), 3);
  insertQ.run(quiz1, 3, 'Why is the "origin" field (web / ws / mobile) useful?',
    JSON.stringify(['It shows which channel/client generated the event', 'It sets the quiz pass score', 'It encrypts the record', 'It is not useful']), 0);

  const m4 = insertModule.run(
    courseId, 4, 'text', 'Using Clickstream Data Responsibly',
    `<p>Because clickstream data can be highly personal, platforms must handle it with
     care: minimize what is collected, secure it in storage, and give learners
     visibility into what is tracked about them.</p>
     <p>In the next module you'll see a live activity log of your own actions inside
     this very app, generated as you click around.</p>`,
    null, null
  ).lastInsertRowid;

  // --- Course 2 modules ---
  const c2m1 = insertModule.run(
    course2Id, 1, 'text', 'Variables and Data Types',
    `<p>A <strong>variable</strong> is a named container for a value. Most languages
     support types such as integers, floating point numbers, strings and booleans.</p>
     <p><code>let score = 100;</code> creates a variable named <code>score</code>
     holding the number 100.</p>`,
    null, null
  ).lastInsertRowid;

  const c2m2 = insertModule.run(
    course2Id, 2, 'video', 'Video: Control Flow Basics',
    `<p>A quick walkthrough of if/else statements and loops.</p>`,
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    null
  ).lastInsertRowid;

  const c2m3 = insertModule.run(
    course2Id, 3, 'quiz', 'Quiz: Programming Basics',
    null, null, null
  ).lastInsertRowid;

  const quiz2 = db.prepare(
    `INSERT INTO quizzes (module_id, title, pass_score) VALUES (?, ?, ?)`
  ).run(c2m3, 'Programming Basics Quiz', 70).lastInsertRowid;

  insertQ.run(quiz2, 1, 'Which keyword commonly declares a variable in JavaScript?',
    JSON.stringify(['let', 'namely', 'declare', 'set']), 0);
  insertQ.run(quiz2, 2, 'What does a loop do?',
    JSON.stringify(['Repeats a block of code', 'Deletes a variable', 'Compiles the program', 'Formats output']), 0);

  console.log('Seed complete.');
  console.log('Admin login:   admin / admin123');
  console.log('Learner login: learner / learner123 (also: priya / learner123)');
}

seed();
