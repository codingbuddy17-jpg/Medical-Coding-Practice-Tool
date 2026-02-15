# Code Review Report: PracticeBuddy Lab (Flascard Generator)

**Project:** Medical Coding Virtual Practice Tool  
**Reviewed:** Build quality, security/data leakages, UI bugs  
**Stack:** Node.js server, vanilla JS frontend, Supabase optional, file-based fallback

---

## 1. Build quality

### Strengths
- **Single-page flow:** Clear separation of server (API + file serving) and client (state, DOM, API calls). `server.js` is structured with explicit route handlers and shared storage helpers.
- **Dual storage:** File-based and Supabase backends are abstracted behind `storage*` functions, so behavior is consistent.
- **Input hardening:** Server-side `sanitizeQuestionCard`, `sanitizeTemplate`, `sanitizeCohortName`, `sanitizeAccessCode`, and request body size limit (1MB) reduce malformed or oversized input risk.
- **Question display:** Main flashcard question/answer use `textContent` (e.g. `dom.cardPrompt.textContent = card.question`), so question/answer text is not rendered as HTML.
- **Exam timer:** `clearInterval(state.exam.timerId)` is called in `stopExam` and in `clearExamTimer()` used from `beforeunload`, so the interval is cleaned up.
- **Script check:** `package.json` has `"check": "node --check app.js && node --check server.js"` for syntax validation.

### Areas to improve
- **No tests:** Only `test_mcq_logic.js` exists; no automated tests for server routes, storage, or client flows. Adding unit tests for API handlers and a few E2E tests for critical paths would help.
- **Monolithic `app.js`:** One large client file (~3.6k+ lines) is hard to maintain. Splitting by feature (auth, deck, exam, trainer, admin, analytics) would improve readability and reuse.
- **Error handling:** Many `catch` blocks only surface a generic message. Differentiating network errors, validation errors, and server errors (and logging server-side) would aid debugging and UX.
- **No rate limiting:** API endpoints (e.g. session start, answer, import) have no rate limiting; the app could be abused or overloaded.

---

## 2. Possible leakages and security

### Critical / high

**2.1 XSS via `innerHTML` with user or imported data**

Several places set `innerHTML` with data that can come from users or imports, without HTML escaping:

| Location (app.js) | Data | Risk |
|-------------------|------|------|
| **~1061** (MCQ options) | `opt` from `card.options` | Imported/question data can run script, e.g. `<script>…</script>` or `<img onerror=…>`. |
| **~871–881** (resources) | `item.title`, `item.url` | Trainer-controlled; malicious title or `javascript:` URL can abuse other users. |
| **~2521** (session table) | `s.userName` | User name is reflected in HTML unescaped. |
| **~2602–2620** (flag queue) | `item.question`, `item.reason`, `by` | Only `"` is escaped in `title=`; other chars (e.g. `<`, `>`, `&`) and cell content are not escaped. |
| **~2216** (import review table) | `item.question`, `reasons` | Same as above. |
| **~3162–3167** (cohort UI) | `cohort.name`, `cohort.accessCode` | Names/codes with `"` or `<>` can break attributes or inject HTML. |
| **~1966** (import preview) | `row.tag`, `question`, `reason` | Import content reflected unescaped. |

**Recommendation:** Introduce a small `escapeHtml(str)` (e.g. replace `&`, `<`, `>`, `"`, `'`) and use it for every string interpolated into HTML or attributes. For URLs, validate scheme (e.g. allow only `https:`) and use `encodeURI`/sanitize for `href`. Option text and other user/import content should never be assigned via `innerHTML` without escaping.

**2.2 Admin “reset data” (Supabase) is incomplete**

In `server.js` (admin reset-data branch), the code lists tables including `sessions`, `attempts`, `cta_events`, `flags`, but the loop body does not perform any delete. Only the “Simpler approach” block runs and deletes from:

- `questions`
- `import_batches`
- `import_batch_items`
- `import_review_queue`

So in Supabase mode, **sessions, attempts, cta_events, and flags are not cleared** on “Hard Reset”. File mode correctly clears everything.

**Recommendation:** Either implement the intended loop (with schema-appropriate delete conditions for each table) or add explicit delete calls for `sessions`, `attempts`, `cta_events`, and `flags` so Supabase reset matches file reset and user expectations.

### Medium

**2.3 Secrets in config / env**

- `TRAINER_KEY`, `TRAINEE_ACCESS_CODE`, `ADMIN_KEY` default to `""` if unset; access config is also persisted in `data/access-config.json`. Ensure env is used in production and config file is not under version control or web root.
- Supabase service role key is server-only; no leakage found in client.

**2.4 Session end on unload**

`beforeunload` uses `navigator.sendBeacon("/api/session/end", payload)` with a JSON string. The server uses `parseBody(req)` and parses the body as JSON, so it works, but the beacon is sent without `Content-Type: application/json`. Some setups might not treat it as JSON. Sending with the correct header (where supported) would be more robust.

**2.5 Trainer key in query string**

Endpoints like `/api/sessions?trainerKey=...` and `/api/import/batches?trainerKey=...` pass the trainer key in the URL. Query strings are often logged. Prefer sending the trainer key in a request body or header for sensitive operations and avoid logging query strings that contain keys.

### Low

- **Path traversal:** `serveFile` uses `path.join(ROOT, safePath)` and then checks `filePath.startsWith(ROOT)`, which correctly blocks paths escaping the app root (e.g. `../`).
- **Payload size:** Request body is limited to 1MB in `parseBody`, which is good.

---

## 3. UI bugs and UX issues

### 3.1 Accessibility
- **Floating WhatsApp link:** `<a id="floatingWhatsappBtn" ... href="#">` then `event.preventDefault()` in click handler: with `href="#"` the link is focusable and can trigger navigation. Prefer `href="https://wa.me/..."` and use JS only to add query params, or use `role="button"` and `tabindex="0"` if it must not navigate.
- **Dynamic tables:** Tables populated with `innerHTML` (sessions, flags, cohorts, import preview, etc.) do not announce changes to screen readers. Consider `aria-live` regions or moving focus to the updated section after load/action.

### 3.2 Consistency and state
- **Duplicate trialInfoWhatsappBtn:** In `dom`, `trialInfoWhatsappBtn` is listed twice (lines ~182 and ~194). Redundant reference only; no functional bug found, but worth deduplicating.
- **Exam timer display:** When exam is not running, `dom.examTimer.textContent` is set to `"Time left: --:--"` or `"Time left: Untimed"`. If the user starts then stops an exam, ensure the label resets to a clear “inactive” state so it’s not misleading.

### 3.3 Forms and validation
- **Cohort select option values:** `cohort.id` is used in `<option value="${cohort.id}">`. If `cohort.id` ever contained `"` or `&`, the markup could break. Escaping attribute values (and using `escapeHtml` for option text) would prevent this.
- **Import preview:** Large imports show only the first 120 rows (`topRows = rows.slice(0, 120)`). The summary still shows full counts; consider adding a note like “Showing first 120 rows” so users know the list is truncated.

### 3.4 Error feedback
- **API errors:** Many `catch` blocks set a single status line (e.g. `setStatus(dom.importStatus, ...)`). If the user scrolls away, the message can be missed. A small toast or persistent error area for critical actions (e.g. session start, import confirm) would improve visibility.
- **Session end on tab close:** If the beacon fails (e.g. slow network), the user is not informed. The session may remain “active” on the server. Optional: retry or show a “Please wait…” message before unload.

### 3.5 Layout and responsiveness
- **styles.css:** Breakpoints at 950px and 580px adjust grid columns and flashcard layout. The flashcard grid switches to a single column on small screens; the “question quarter” and “answer quarter” sections stack. This is reasonable; no obvious overflow or overlap issues found.
- **Tables:** `.table-wrap` uses `overflow: auto` and tables have `min-width: 520px`, so horizontal scroll on small screens is expected. No bug, but very small viewports may feel cramped.

### 3.6 Possible null reference
- **DOM references:** `dom` is built from `document.getElementById(...)` at load. If any ID is missing in `index.html`, that entry will be `null` and later access (e.g. `dom.someEl.textContent = ...`) will throw. A quick check that all required elements exist after DOM ready (or guard before use) would harden the app.

---

## 4. Summary

| Category            | Verdict |
|---------------------|--------|
| **Build quality**    | Solid structure and sanitization; would benefit from tests, smaller modules, and rate limiting. |
| **Security**        | XSS risk in multiple `innerHTML` usages; admin Supabase reset does not clear all tables; trainer key in query string. |
| **UI / UX**         | Minor a11y and state issues; error visibility and session-end feedback could be improved. |

**Top 3 fixes to do first**
1. **Escape all user/import content** before using it in `innerHTML` or in HTML attributes (and sanitize resource URLs).
2. **Complete Supabase admin reset** so sessions, attempts, cta_events, and flags are deleted when the user performs a full reset.
3. **Add an `escapeHtml` helper** and use it consistently anywhere dynamic text is inserted into the DOM (tables, options, labels, titles).

After that, consider rate limiting on the server, moving trainer key out of query strings for sensitive calls, and improving error and session-end feedback in the UI.
