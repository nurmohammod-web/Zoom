import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { countActiveParticipants, MAX_PARTICIPANTS } from "../../../../lib/rooms";

export const dynamic = "force-dynamic";

// GET /api/rooms/[slug]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const room = await prisma.room.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, isActive: true, createdAt: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const activeCount = await countActiveParticipants(room.id);
  return NextResponse.json({
    ...room,
    activeCount,
    isFull: activeCount >= MAX_PARTICIPANTS,
    maxParticipants: MAX_PARTICIPANTS,
  });
}
