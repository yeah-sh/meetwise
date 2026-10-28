// GET /api/health: checks that the app can reach PostgreSQL.
import { connection } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // With cacheComponents on, a GET handler can be prerendered at build time.
  // connection() makes this check run on every request instead.
  await connection();

  try {
    const meetings = await prisma.meeting.count();
    return Response.json({ ok: true, db: "connected", meetings });
  } catch (error) {
    // Full details stay in the server log; the response only says what to check.
    console.error("[health] database check failed:", error instanceof Error ? error.message : error);
    return Response.json(
      {
        ok: false,
        db: "unreachable",
        error:
          "Cannot reach the database. Check that PostgreSQL is running and that DATABASE_URL in .env.local is correct.",
      },
      { status: 500 },
    );
  }
}
