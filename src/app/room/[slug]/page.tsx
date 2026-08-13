import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import RoomClient from "../../../components/RoomClient";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await prisma.room.findUnique({
    where: { slug },
    select: { name: true, isActive: true },
  });

  if (!room || !room.isActive) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <RoomClient slug={slug} roomName={room.name} />
    </div>
  );
}
