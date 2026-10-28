# prisma

Prisma schema (`schema.prisma`), migrations and seed script for the `meeting_app` PostgreSQL database.

- The connection URL is set in `prisma.config.ts` at the project root, which loads `DATABASE_URL` from `.env.local`.
- `npm run db:migrate -- --name <change>` creates and applies a migration; `npm run db:seed` inserts a sample meeting; `npm run db:studio` opens Prisma Studio.
- The generated client lives in `src/generated/prisma/` (git-ignored). `npm install` regenerates it automatically (the `postinstall` script runs `prisma generate`).
