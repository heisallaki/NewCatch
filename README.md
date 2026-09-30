# New Catch

New Catch is a social discovery app made only for verified JKUAT students. Students can meet people through shared interests, hobbies, music and what they are looking for, whether that is friendship, networking, a study buddy or dating.

## Main features

- Sign-up restricted to `@student.jkuat.ac.ke` emails with one-time code verification
- Login that requires password and an emailed one-time code
- Forgot password and reset flow
- Profiles, discovery with Catch and Swerve, and real-time messaging (in progress)
- Admin moderation with account deactivation, appeals and permanent blacklisting
- Privacy policy, terms, community guidelines, safety, reporting and appeals pages

## Technology

- Frontend: Expo, React Native, TypeScript, Expo Web (one codebase for Web, Android and iOS)
- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Email: SMTP

## Local setup

1. Copy `.env.example` to `.env` and fill in the secrets.
2. Create the `newcatch` PostgreSQL database.
3. Backend: create a virtual environment in `backend/`, run `pip install -r requirements.txt`, run `alembic upgrade head`, then `uvicorn app.main:app --reload`.
4. Frontend: in `frontend/`, run `npm install`, then `npm run web`.

## Status

Phase 1 (authentication, moderation foundation, policies, public landing page) is in place. Profiles, discovery, matching and messaging are next.

## Contact

kal.projects.dev@gmail.com