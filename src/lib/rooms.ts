import { prisma } from "./prisma";

export const MAX_PARTICIPANTS = 4;

// Human-friendly, URL-safe room slug (no ambiguous chars).
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomSlug(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

// Generate a slug that isn't already taken.
export async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug();
    const existing = await prisma.room.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  // Extremely unlikely; fall back to a longer slug.
  return randomSlug(12);
}

// Map a guest display name to a stable User row (same name -> same user).
// Reuses the upsert pattern from prisma/seed.ts.
export async function upsertGuestUser(name: string) {
  const displayName = name.trim() || "Guest";
  const normalized = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `guest_${normalized}@local`;
  return prisma.user.upsert({
    where: { email },
    update: { name: displayName },
    create: { email, name: displayName },
  });
}

export async function countActiveParticipants(roomId: string): Promise<number> {
  return prisma.roomParticipant.count({
    where: { roomId, leftAt: null },
  });
}
