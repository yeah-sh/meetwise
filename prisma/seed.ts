// Inserts one sample READY meeting with report items and a short chat.
// Run with `npm run db:seed`. Safe to re-run: the sample meeting has a fixed id and is
// deleted (with its children, via cascade) before being created again.
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Standalone script, so load .env.local ourselves (Next.js is not running).
loadEnvConfig(process.cwd(), true);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SAMPLE_MEETING_ID = "seed-sample-meeting";

const transcript = `Priya: Morning everyone. Agenda today: the beta launch date and the onboarding emails.
Marcus: Design for the onboarding emails is done. I can hand it to engineering on Monday.
Priya: Great. Then let's lock the beta launch for November 20th.
Lena: That works if QA gets the build by November 13th. I'll own the release checklist.
Marcus: One risk: the email provider migration isn't finished, so emails might not send on launch day.
Priya: Good catch. Lena, can you check with the provider and report back on Thursday?
Lena: Will do. Do we still need legal to review the beta terms?
Priya: Yes, legal confirmed they'll review the terms by November 15th.
Marcus: Our survey also showed most beta users sign up from mobile, so we should test there first.
Priya: Agreed. Thanks all, see you next week.`;

async function main() {
  await prisma.meeting.deleteMany({ where: { id: SAMPLE_MEETING_ID } });

  const meeting = await prisma.meeting.create({
    data: {
      id: SAMPLE_MEETING_ID,
      title: "Weekly product sync",
      description: "Sample meeting created by prisma/seed.ts",
      status: "READY",
      // No real file exists for the sample; this only shows the expected shape.
      audioFileName: "weekly-product-sync.mp3",
      audioPath: path.join("storage", "uploads", "seed-sample-meeting.mp3"),
      audioMimeType: "audio/mpeg",
      audioSizeBytes: 1_048_576,
      transcript,
      summary:
        "The team set the beta launch for November 20th, with QA receiving the build by " +
        "November 13th. Onboarding email designs are ready for engineering, and the " +
        "unfinished email provider migration was flagged as a launch risk.",
      reportItems: {
        create: [
          { category: "AGENDA", text: "Beta launch date", position: 0 },
          { category: "AGENDA", text: "Onboarding emails", position: 1 },
          { category: "ATTENDEE", text: "Priya", detail: "Meeting lead", position: 2 },
          { category: "ATTENDEE", text: "Marcus", detail: "Design", position: 3 },
          { category: "ATTENDEE", text: "Lena", detail: "Release and QA", position: 4 },
          { category: "DECISION", text: "Beta launches on November 20th", position: 5 },
          {
            category: "TASK",
            text: "Hand onboarding email designs to engineering",
            owner: "Marcus",
            dueDate: new Date("2026-11-02"),
            position: 6,
          },
          {
            category: "TASK",
            text: "Own the release checklist",
            owner: "Lena",
            position: 7,
          },
          {
            category: "DEADLINE",
            text: "QA receives the beta build",
            dueDate: new Date("2026-11-13"),
            position: 8,
          },
          {
            category: "RISK",
            text: "Email provider migration is not finished",
            detail: "Onboarding emails might not send on launch day",
            position: 9,
          },
          {
            category: "FOLLOW_UP",
            text: "Check status with the email provider and report back",
            owner: "Lena",
            position: 10,
          },
          {
            category: "QUESTION",
            text: "Does legal still need to review the beta terms?",
            status: "answered",
            detail: "Yes, legal will review the terms by November 15th.",
            position: 11,
          },
          {
            category: "INSIGHT",
            text: "Most beta users sign up from mobile, so test there first",
            position: 12,
          },
        ],
      },
      chatMessages: {
        create: [
          {
            role: "USER",
            content: "When is the beta launching?",
            inputMode: "VOICE",
            createdAt: new Date("2026-10-28T10:00:00Z"),
          },
          {
            role: "ASSISTANT",
            content:
              "The beta launches on November 20th, as long as QA gets the build by November 13th.",
            createdAt: new Date("2026-10-28T10:00:05Z"),
          },
        ],
      },
    },
    include: { _count: { select: { reportItems: true, chatMessages: true } } },
  });

  console.log(
    `Seeded meeting "${meeting.title}" (${meeting.id}) with ` +
      `${meeting._count.reportItems} report items and ${meeting._count.chatMessages} chat messages.`,
  );
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  // A failed disconnect would otherwise be an unhandled rejection.
  .finally(() => prisma.$disconnect().catch(() => {}));
