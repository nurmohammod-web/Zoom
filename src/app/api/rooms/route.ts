import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { generateUniqueSlug, upsertGuestUser } from "../../../lib/rooms";

export const dynamic = "force-dynamic";

// POST /api/rooms  { name?: string, hostName: string }
export async function POST(request: Request) {
  let body: { name?: string; hostName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hostName = (body.hostName ?? "").trim();
  if (!hostName) {
    return NextResponse.json({ error: "hostName is required" }, { status: 400 });
  }

  const host = await upsertGuestUser(hostName);
  const slug = await generateUniqueSlug();
  const room = await prisma.room.create({
    data: {
      slug,
      name: (body.name ?? "").trim() || `${hostName}'s room`,
      hostId: host.id,
    },
  });

  return NextResponse.json(
    { slug: room.slug, name: room.name, id: room.id },
    { status: 201 },
  );
}
