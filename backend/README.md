# Viniyog backend

## Local setup

1. Install Node.js and MySQL.
2. From `backend`, run `npm install`.
3. Copy `.env.example` to `.env` and set local MySQL credentials. `.env` is ignored by Git.
4. For a fresh **development** database only, apply the existing base SQL scripts in dependency order: `students.sql`, `student_profiles.sql`, `skills.sql`, `student_teach_skills.sql`, `student_learn_skills.sql`, and `notes.sql`. If using an existing database, inspect its schema rather than re-running the non-idempotent base scripts.
5. Review and apply `database/migrations/001_v1_features.sql` to that development database. From PowerShell in `backend`, the migration can be applied with `Get-Content .\database\migrations\001_v1_features.sql | mysql -u your_local_user -p`. It creates password, revocable session, and skill-exchange request tables and adds a unique account-email index when current profile data permits. If existing profile records have duplicate email addresses, it preserves those rows, reports that the email index was skipped, and continues creating the remaining tables. Resolve duplicate addresses without discarding account data before adding the unique index. The migration is not run automatically by the application. Do not apply it to production without a separate review and approval.
6. Apply the additive `database/migrations/002_profile_other_contact.sql` migration to an existing database. It adds the `other_contact` column used by the current signup and profile queries when missing. It does not alter or delete existing values.
7. Run `npm test`, then `npm start`. Browse to `http://localhost:5000`.

When running the frontend from a separate local web server, add its exact origin to `FRONTEND_ORIGINS` in `.env` (comma-separated). The default list allows localhost ports 5000 and 5500. The app uses HTTP-only cookies; production deployments must use HTTPS and set `NODE_ENV=production`. For a frontend hosted on a different site, configure `SESSION_COOKIE_SAME_SITE=None` (which requires HTTPS).

## Feature access

- Public student search includes academic details and skills. Student profile pages include biography, skills, chosen profile links, mobile number, and email address as requested. PRN, WhatsApp, and password data are not included in public profile responses.
- Signup and login accept multipart form and JSON respectively. Login accepts a PRN or email. `Remember me` controls a 7-day session; otherwise sessions expire after 12 hours. Logout revokes the server-side session.
- PRN is not treated as a global uniqueness key; students from different colleges may share a PRN. Email remains the unique account identifier for signup and login.
- Notes are shared among authenticated students. Only PDF and UTF-8 plain-text files up to 10 MB are accepted. Uploads are stored outside the web root and downloads require authentication.
- Students can update their own profile photo, teach/learn skill lists, biography, mobile number, and unique account email from their profile. Updates use the existing tables and authenticated session identity. Notes remain one-to-many, and uploads are appended rather than replacing prior notes.
- Students can delete their own account only after verifying the current password; the backend deletes the account and associated student-owned data while preserving unrelated records.
- Exchange requests are created only for skills the requester teaches and the recipient teaches. Request status listing is private to the request participants. Request acceptance/decline is not part of this version.

If signup or login reports that authentication storage is not initialized, apply `database/migrations/001_v1_features.sql` to the configured development database. It creates `student_auth` and `student_sessions`; the app does not run schema migrations automatically.
