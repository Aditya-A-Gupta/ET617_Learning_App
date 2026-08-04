-- LearnStream database schema
-- SQLite

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'learner', -- learner | admin
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enrollments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  course_id   INTEGER NOT NULL REFERENCES courses(id),
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

-- A module is one unit of interactive content inside a course.
-- type: 'text' | 'video' | 'quiz' | 'mixed'
CREATE TABLE IF NOT EXISTS modules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id   INTEGER NOT NULL REFERENCES courses(id),
  order_index INTEGER NOT NULL DEFAULT 0,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body_html   TEXT,          -- for text / mixed content
  video_url   TEXT,          -- for video / mixed content
  video_poster TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id  INTEGER NOT NULL REFERENCES modules(id),
  title      TEXT NOT NULL,
  pass_score INTEGER NOT NULL DEFAULT 70
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id       INTEGER NOT NULL REFERENCES quizzes(id),
  order_index   INTEGER NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL,
  options_json  TEXT NOT NULL, -- JSON array of option strings
  correct_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id),
  answers_json TEXT NOT NULL,
  score        INTEGER NOT NULL,
  passed       INTEGER NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_progress (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  module_id    INTEGER NOT NULL REFERENCES modules(id),
  status       TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | completed
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, module_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  course_id   INTEGER NOT NULL REFERENCES courses(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS course_ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  course_id   INTEGER NOT NULL REFERENCES courses(id),
  rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS module_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  module_id   INTEGER NOT NULL REFERENCES modules(id),
  note_text   TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, module_id)
);

-- The core clickstream / activity log table.
-- Mirrors the structure of the Moodle-style log export shown in the brief:
-- Time | Event context | Component | Event name | Description | Origin | IP address
CREATE TABLE IF NOT EXISTS clickstream (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time    TEXT NOT NULL DEFAULT (datetime('now')),
  user_id       INTEGER REFERENCES users(id),
  event_context TEXT NOT NULL,   -- e.g. "Course: ET 610 ..." or "System"
  component     TEXT NOT NULL,   -- e.g. "System", "Logs", "Forum", "Quiz", "Video"
  event_name    TEXT NOT NULL,   -- e.g. "Course viewed", "Quiz attempt submitted"
  description   TEXT NOT NULL,   -- human readable description
  origin        TEXT NOT NULL DEFAULT 'web', -- web | ws | mobile
  ip_address    TEXT,
  course_id     INTEGER REFERENCES courses(id),
  module_id     INTEGER REFERENCES modules(id),
  meta_json     TEXT            -- free-form extra data (e.g. video position, quiz score)
);

CREATE INDEX IF NOT EXISTS idx_clickstream_user ON clickstream(user_id);
CREATE INDEX IF NOT EXISTS idx_clickstream_course ON clickstream(course_id);
CREATE INDEX IF NOT EXISTS idx_clickstream_time ON clickstream(event_time);
