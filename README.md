# PracticeBuddy Lab — by CodingBuddy360

Medical coding practice and assessment platform for training programs, certification prep, and performance tracking.

## Quick Start

```bash
npm install
npm start
# App available at http://localhost:4173
```

## Storage Modes

### File-Based (Development Only)

The default mode. No extra configuration needed. Data is stored in the `data/` directory as JSON files.

**Do not use file-based storage in production.** JSON files have no concurrent-write protection — simultaneous requests can corrupt data. Use this mode only for local development and testing.

### Supabase (Recommended for Production)

Set these environment variables to enable Supabase:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-side only, never expose to browser
```

Also configure `app.config.js` for client-side Supabase Auth (Google OAuth):

```javascript
window.APP_CONFIG = {
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key",             // safe to expose in browser
  REQUIRE_GOOGLE_FOR_TRIAL_TRAINEE: true
};
```

Run the schema from `SUPABASE_IMPORT_FEATURES.sql` in your Supabase SQL editor to create the required tables.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4173` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `TRAINER_KEY` | `""` | Trainer authentication key |
| `TRAINEE_ACCESS_CODE` | `""` | Trainee access code (legacy) |
| `ADMIN_KEY` | `""` | Admin authentication key |
| `SUPABASE_URL` | `""` | Supabase project URL (enables Supabase mode) |
| `SUPABASE_SERVICE_ROLE_KEY` | `""` | Supabase service role key (server-side only) |
| `MAX_BODY_SIZE` | `10485760` | Max request body size in bytes (10MB) |

## Roles

| Role | Access |
|---|---|
| **Trial** | Limited to `trialQuestionLimit` questions (default 20), practice only |
| **Trainee** | Full practice + exams, scoped to cohort assignment, requires email allowlist |
| **Trainer** | Full access + Mentor HQ console (question import, session analytics, cohort management) |

## Coding Streams

ICD-10-CM · ICD-10-PCS · CPT · Modifiers · Guidelines · CCS · CPC · CDIP · Surgery Coding · IP-DRG Coding · Medicine · Practice Cases

## Project Structure

```
app.config.js        Client-side configuration (Supabase URL, anon key, flags)
app.import.js        CSV/XLSX import parsing and validation
app.core.js          Constants, application state, DOM cache, utility functions
app.helpers.js       URL/date/card codec helpers, localStorage, text matching
app.practice.js      Flashcard rendering, answer checking, study queue, category UI
app.exam.js          Exam mode, timer, blueprint queue builder, shuffle
app.session.js       Session tracking, adaptive logic, API request, session start/end
app.answer.js        Answer validation, skip, next-question handlers
app.trainer.js       Trainer tools: import preview, question bank, session console, flags
app.admin.js         Admin panel: cohorts, learner access, access config
app.init.js          Event binding, navigation, app initialization
server.js            Node.js HTTP server with 40+ REST API endpoints
data/                File-based storage (dev only — use Supabase in production)
```

## Documentation

- [USER_GUIDE.md](./USER_GUIDE.md) — Full user and feature guide
- [TRAINER_QUICK_START.md](./TRAINER_QUICK_START.md) — Trainer quick reference
- [CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md) — Security audit notes
