# New Catch

New Catch is a social discovery app made only for verified JKUAT students. Students can meet people through shared interests, hobbies, music and what they are looking for, whether that is friendship, networking, a study buddy or dating.

## Main features

- Sign-up restricted to `@students.jkuat.ac.ke` emails with one-time code verification
- Login that requires password and an emailed one-time code, plus a forgot password flow
- Profiles with photos, gender, interests, music and privacy controls
- Discovery with Catch and Swerve, New Catch Match explanations and "It's a New Catch!"
- Real-time one-to-one chat for mutual Catches (WebSockets)
- Block, unmatch and Report User with screenshot attachments
- Admin moderation: reports, deactivation, appeals (including blacklist appeals), photo removal and permanent blacklisting
- Privacy policy, terms, community guidelines, safety, reporting and appeals pages

## Technology

- Frontend: Expo, React Native, TypeScript, Expo Web (one codebase for Web, Android and iOS)
- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL, FastAPI WebSockets
- Email: SMTP

## Local setup

1. Copy `.env.example` to `.env` and fill in the secrets.
2. Create the `newcatch` PostgreSQL database.
3. Backend: create a virtual environment in `backend/`, run `pip install -r requirements.txt`, run `alembic upgrade head`, then `uvicorn app.main:app --reload`.
4. Frontend: in `frontend/`, copy `.env.example` to `.env`, run `npm install`, then `npm run web`.

## Status

The MVP feature set is in place. Remaining work is hardening, deployment and real-device testing.

## Contact

kal.projects.dev@gmail.com