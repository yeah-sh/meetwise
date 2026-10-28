-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('UPLOADED', 'TRANSCRIBING', 'ANALYSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('TASK', 'DECISION', 'QUESTION', 'INSIGHT', 'DEADLINE', 'ATTENDEE', 'FOLLOW_UP', 'RISK', 'AGENDA');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "InputMode" AS ENUM ('TEXT', 'VOICE');

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "audioFileName" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "audioMimeType" TEXT NOT NULL,
    "audioSizeBytes" INTEGER NOT NULL,
    "transcript" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "text" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT,
    "detail" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "inputMode" "InputMode" NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportItem_meetingId_idx" ON "ReportItem"("meetingId");

-- CreateIndex
CREATE INDEX "ChatMessage_meetingId_createdAt_idx" ON "ChatMessage"("meetingId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReportItem" ADD CONSTRAINT "ReportItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
