// Shared TypeScript types: meetings, report sections, chat messages.
// Safe for client components: the enum type comes from Prisma's browser-safe enums file.
import type { MeetingStatus } from "@/generated/prisma/enums";

export type { MeetingStatus };

// Body of every API error response.
export type ApiError = { error: string };

// 202 from POST /api/meetings and POST /api/meetings/[id]/retry.
export type ProcessingStarted = { id: string; status: MeetingStatus };

// GET /api/meetings/[id]/status
export type MeetingStatusResponse = { status: MeetingStatus; errorMessage: string | null };
