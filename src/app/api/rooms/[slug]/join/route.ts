import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  countActiveParticipants,
  upsertGuestUser,
  MAX_PARTICIPANTS,
} from "../../../../../lib/rooms";

export const dynamic = "force-dynamic";

// POST /api/rooms/[slug]/join  { name: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room || !room.isActive) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const user = await upsertGuestUser(name);

  // Reuse an existing active participation (rejoin) instead of duplicating.
  const existing = await prisma.roomParticipant.findFirst({
    where: { roomId: room.id, userId: user.id, leftAt: null },
  });
  if (existing) {
    return NextResponse.json({
      participantId: existing.id,
      userId: user.id,
      name: user.name,
    });
  }

  const activeCount = await countActiveParticipants(room.id);
  if (activeCount >= MAX_PARTICIPANTS) {
    return NextResponse.json(
      { error: "Room is full", maxParticipants: MAX_PARTICIPANTS },
      { status: 403 },
    );
  }

  const participant = await prisma.roomParticipant.create({
    data: { roomId: room.id, userId: user.id },
  });

  return NextResponse.json(
    { participantId: participant.id, userId: user.id, name: user.name },
    { status: 201 },
  );
}
