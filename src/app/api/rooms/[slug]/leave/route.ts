import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/rooms/[slug]/leave  { participantId: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: { participantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantId = (body.participantId ?? "").trim();
  if (!participantId) {
    return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Only mark still-active participations; idempotent for double-leave.
  await prisma.roomParticipant.updateMany({
    where: { id: participantId, roomId: room.id, leftAt: null },
    data: { leftAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
