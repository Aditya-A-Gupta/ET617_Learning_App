# LearnStream

A standalone web application for interactive learning with full **clickstream
analytics**. Learners log in, work through courses made of text, video, and
quiz content, and every interaction (page views, clicks, video play/pause/seek,
quiz attempts, logins, etc.) is captured as a structured activity-log event -
in the same spirit as the Moodle-style log export in the project brief.

## Features

- **Learner accounts** - register / log in / log out, JWT session in an
  httpOnly cookie, passwords hashed with bcrypt.
- **Interactive content** - each course is a sequence of modules that can be
  `text`, `video`, or `quiz` (auto-graded, multiple choice, pass/fail).
- **Clickstream tracking** - every meaningful action is written to a
  `clickstream` table with the same columns as the brief's example:
  `Time, Event context, Component, Event name, Description, Origin, IP address`.
- **Instructor / admin view** (`/admin.html`) - live stats, a filterable,
  paginated activity-log table, and a **CSV export** that reproduces the
  exact column layout from the brief.
- **Progress tracking, bookmarks, ratings, personal notes, a profile page,
  and downloadable completion certificates** - see the full action list below.
- **Responsive, themeable UI** - works from a 360px phone screen up to a
  desktop monitor, with a light/dark mode toggle.

## The 20+ trackable user actions

Every one of these is a real interaction a learner or admin can perform in
the UI, and each writes a row to the `clickstream` table:

 1. Register a new account
 2. Log in
 3. Log out
 4. View a course
 5. View a module (text / video / quiz)
 6. Mark a text or video module complete
 7. Play a video
 8. Pause a video
 9. Seek within a video
10. Reach 25% / 50% / 75% of a video, and finish it (video ended)
11. Start a quiz
12. Select a quiz answer option
13. Submit a quiz attempt (auto-graded)
14. Bookmark / unbookmark a course
15. Rate a course (1–5 stars)
16. Save a personal note on a module
17. Search courses on the dashboard
18. Sort courses on the dashboard
19. Toggle light/dark theme
20. Download a course-completion certificate
21. View your profile page
22. (Admin) Filter the activity log by component
23. (Admin) Load more log rows (pagination)
24. (Admin) Export the activity log as CSV
25. Generic UI clicks - every element tagged `data-track="..."` (nav links,
    buttons) is captured automatically

## Responsive design

The layout adapts at three breakpoints (defined in `public/css/style.css`):

- **≥900px (desktop):** two-column course layout (module sidebar + content),
  4–5 column stat grid, multi-column course grid.
- **620–900px (tablet):** module sidebar collapses into a horizontally
  scrollable strip above the content; stat grid drops to 2 columns.
- **≤620px (mobile):** single-column course grid, stacked toolbars and forms,
  the log table scrolls horizontally instead of overflowing, and the topbar
  wraps its navigation.

Try resizing the browser window or opening dev tools' device toolbar on any
page - nothing requires a page reload to adapt.

## Visual design

Palette: ink `#171B21` / paper `#EEF1F5` with indigo, teal, and amber accents
(a separate dark palette is used automatically in dark mode). Typography
pairs an editorial serif (Fraunces) for headings with Inter for body text and
IBM Plex Mono for anything log/data-related - reinforcing that this is, at
its core, a data-logging application. The scrolling activity ticker on the
dashboard (visible to admins) is the app's signature element, showing
clickstream rows arriving in real time.

## Tech stack

- **Backend:** Node.js, Express, `better-sqlite3` (zero-config file database),
  `bcryptjs`, `jsonwebtoken`.
- **Frontend:** Plain HTML/CSS/JavaScript (no build step required), served
  statically by Express.
- **Storage:** SQLite file at `server/db/learnstream.db` (created automatically
  on first run; schema in `server/db/schema.sql`).

No external services or API keys are required - the whole app runs locally.

## Getting started

```bash
npm install
npm run seed      # creates the SQLite DB and demo data
npm start         # starts the server on http://localhost:3000
```

Open http://localhost:3000 in a browser.

### Demo accounts

| Role    | Username | Password    |
|---------|----------|-------------|
| Learner | learner  | learner123  |
| Admin   | admin    | admin123    |

Log in as `learner` to experience the course content and generate
clickstream data, or log in as `admin` to view `/admin.html`, the live
activity log and CSV export.

## Project structure

```
learning-app/
├── server/
│   ├── server.js            # Express app entry point
│   ├── db/
│   │   ├── schema.sql       # table definitions (incl. clickstream table)
│   │   ├── index.js         # opens the SQLite DB, applies schema
│   │   └── seed.js          # demo users, courses, modules, quizzes
│   ├── middleware/
│   │   └── auth.js          # JWT cookie auth (requireAuth / requireAdmin)
│   ├── lib/
│   │   └── clickstream.js   # logEvent() helper used by every route
│   └── routes/
│       ├── auth.js          # register / login / logout / me
│       ├── courses.js       # course list, module content, progress, bookmarks, ratings, notes
│       ├── quiz.js          # quiz submission + grading
│       ├── track.js         # generic client-emitted event endpoint
│       ├── admin.js         # log viewer, CSV export, summary stats
│       └── profile.js       # learner profile stats + recent activity
└── public/                  # static frontend (no build step)
    ├── index.html            # redirects to /login or /dashboard
    ├── login.html
    ├── dashboard.html         # search, sort, bookmarks, progress bars
    ├── course.html            # module sidebar, text/video/quiz viewer, notes, rating, certificate
    ├── admin.html              # instructor activity-log dashboard (filter + pagination)
    ├── profile.html            # learner stats, bookmarks, personal activity feed
    ├── css/style.css           # design tokens, dark mode, responsive breakpoints
    └── js/
        ├── api.js             # fetch() wrapper
        ├── tracker.js         # sends events to POST /api/track
        └── theme.js           # light/dark theme toggle
```

## How clickstream data is captured

Every server route that represents a meaningful learner action calls
`logEvent()` (`server/lib/clickstream.js`), which inserts one row into the
`clickstream` table with the visitor's real IP address (`req.ip`, or
`X-Forwarded-For` behind a proxy), the authenticated user id, and a
human-readable description modeled directly on the brief's example rows, e.g.:

> "The user with id '3766' viewed the course with id '4275'."

Interactions that only make sense client-side (video progress, individual
quiz-option clicks, generic UI clicks tagged with `data-track="..."`) are
sent from the browser to `POST /api/track`, which validates the event name
against an allow-list and writes it through the same `logEvent()` path.

Admins can browse the raw log at `/admin.html`, filter it by component, and
export the full table as CSV via `GET /api/admin/clickstream/export.csv` -
the exported columns match the brief's example 1:1.

## Version control

This project is tracked with git; see the commit history for the build
progression (schema → API → frontend → tracking → docs).
