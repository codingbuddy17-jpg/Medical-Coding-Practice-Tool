# Medical Coding Virtual Practice Tool - Detailed User Guide

## 1. Purpose
This application is a role-based practice and assessment platform for medical coding training programs.

It supports:
- Interactive short-answer and MCQ practice
- Trial, trainee, and trainer access control
- Cohort/class management
- Timed exam mode with blueprint templates
- Session analytics and weak-topic drill recommendations
- Trainer-side question bank import/export
- PDF completion report generation

## 2. How To Use This Guide
Use this guide in the same order as real usage:
1. Setup and login model
2. Learner practice flow
3. Trainer operations
4. Admin/cohort controls
5. Exam blueprint assignment
6. Analytics, recommendations, and reports
7. CSV/XLSX format reference
8. Troubleshooting

If you are a trainer, focus on sections 4-10 first.

## 3. Roles And Access Model
The app supports 3 roles at session start:

- Trial User
  - Must enter name, email, and phone
  - Limited by configured trial question limit
  - Cannot use exam mode
  - One-trial-per-identity anti-abuse logic is enforced (email/phone)

- Trainee
  - Must enter name, email, phone, and access code
  - Access code can be:
    - Global trainee code, or
    - Cohort/class-specific code
  - If cohort code is used, cohort assignment and limits are applied

- Trainer
  - Must enter trainer key
  - Can import/export question bank, manage resources, view sessions, load analytics, assign blueprints

## 4. Session Start Workflow
1. Fill `Name`, `Email`, `Phone`.
2. Choose role (`Trial User`, `Trainee`, or `Trainer`).
3. Enter role-specific key/code if prompted.
4. Click `Start`.

Top metrics immediately track:
- Correct Answers
- Wrong Answers
- Attempted
- Session Score

## 5. Practice Interface (Learner Side)

### 5.1 Category Selection
Use tag buttons to filter practice by coding stream:
- ICD-10-CM
- ICD-10-PCS
- CPT
- Modifiers
- Guidelines
- CCS
- CPC
- CDIP
- All Tags

### 5.2 Question Types
- Short answer:
  - Enter response in text box
  - Click `Check`
  - Feedback remains until `Next` is clicked

- MCQ:
  - Select option button
  - Click `Check`
  - Feedback remains until `Next` is clicked

### 5.3 Weak Topic Drill
- Enable `Weak Topic Drill Mode` to prioritize weaker categories/cards in study progression.

## 6. Timed Exam Mode

### 6.1 Manual Exam Configuration
Use `Timed Exam Options`:
- Blueprint = `Manual`
- Questions
- Duration
- Pass Threshold (%)
- Strict Timing (on/off)

### 6.2 Blueprint-Based Exams
If a blueprint is selected, the exam queue is generated using blueprint tags and rules.

Predefined blueprints:
- ICD-Heavy Mock
- CPT-Heavy Mock
- Mixed Final Mock

### 6.3 Cohort-Assigned Exams
If trainee entered a cohort code and trainer assigned a blueprint to that cohort:
- Exam settings auto-load from assignment
- Trainee exam controls are locked

### 6.4 Exam Completion
Exam status shows:
- Answer progress
- Time left or `Untimed`
- Pass/Fail on completion using configured threshold

## 7. Trainer Features

### 7.1 Trainer Deck Manager
Available only to trainer role.

Supports:
- Import from CSV/TSV/TXT/XLSX/XLS
- Import from pasted text
- Export full deck to CSV
- Load starter deck

### 7.2 Trainer Session Console
- Click `Refresh Sessions` to view recent sessions and summary.

### 7.3 Resource Manager
Trainer can add/remove useful coding links shown in learner workspace.

## 8. Admin Access Control And Cohort Management
Inside trainer zone, `Admin Access Control` adds privileged controls.

### 8.1 Verify Admin
1. Enter `Admin Key`
2. Click `Verify Admin`
3. Click `Load Admin Data`

### 8.2 Global Access Settings
Can update:
- Trainee Access Code
- Trainer Key
- Trial Question Limit

Click `Save Access Settings`.

### 8.3 Cohort/Class Management
Can create/update cohorts with:
- Cohort Name
- Cohort Access Code
- Cohort Question Limit
- Active/Inactive status

Can enroll/update members by:
- Cohort selection
- Member email (required)
- Name/phone (optional but recommended)

## 9. Exam Blueprint Assignment (Trainer/Admin)
Inside admin tools:
1. Select cohort
2. Select blueprint template
3. Optionally override:
   - Questions
   - Duration
   - Pass threshold
   - Strict timing
4. Click `Assign to Selected Cohort`

Result:
- Cohort trainees get standardized exam policy.

## 10. Weak-Topic Analytics Dashboard
Trainer can view analytics for:
- Per user (email)
- Per cohort (batch)

Includes:
- Accuracy by tag
- Trend by day over selected window (7/14/30/60 days)
- Recommended weak tags for daily drill

Buttons:
- `Load User Analytics`
- `Load Batch Analytics`
- `Recommend Daily Drill`
- `Share Trend by Email`

Email sharing currently opens a prefilled email draft in local mail client (`mailto` flow).

## 11. PDF Completion Report Export
Use top bar `Export PDF Report`.

Report includes:
- Learner identity and role
- Session start and report generated time
- Attempted/correct/wrong/score
- Exam threshold and pass/fail
- Per-category breakdown

Use cases:
- Completion proof
- Batch motivation
- Marketing testimonials

## 12. Import File Format Reference

### 12.1 Preferred Header
Use:
`tag,type,question,answer,option_a,option_b,option_c,option_d,correct_option`

### 12.2 Short Answer Row
- `type = short`
- fill `answer`
- options/correct_option can be empty

Example:
`ICD-10-CM,short,Type 2 diabetes mellitus without complications,E11.9,,,,,`

### 12.3 MCQ Row
- `type = mcq`
- leave `answer` empty
- fill `option_a` to `option_d`
- `correct_option` must be `A/B/C/D`

Example:
`CPT,mcq,Which code is routine ECG with interpretation?,,93000,93010,93005,93224,A`

## 13. Security And Governance Notes
- Trainer and trainee code checks are server-side.
- Trial anti-abuse blocks repeated trial by email/phone.
- Admin operations require admin authorization.
- Cloud mode is supported via Supabase env variables.

## 14. Troubleshooting

### 14.1 Invalid trainer/trainee/admin code
- Recheck code value in Access Settings (admin panel).
- Ensure latest deployment after key change.

### 14.2 Import fails
- Verify headers and file encoding.
- For Excel, use first worksheet.
- Ensure MCQ rows include all four options and correct option.

### 14.3 No analytics data
- Ensure sessions and attempts exist for selected email/cohort.
- Verify cohort members are enrolled with matching email.

### 14.4 Cohort trainee not receiving assigned blueprint
- Confirm trainee started session with cohort access code.
- Confirm assignment exists for that exact cohort.

### 14.5 PDF report not generating
- Refresh browser to reload JS libraries.
- Ensure session has started.

## 15. Recommended Operational Flow For Batches
1. Configure access settings.
2. Create cohorts and enroll members.
3. Import question bank in batches.
4. Assign blueprint per cohort.
5. Run training/practice sessions.
6. Monitor analytics weekly.
7. Use drill recommendations for targeted revision.
8. Export PDF reports for completion records.
