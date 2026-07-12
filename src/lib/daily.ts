import "server-only";
import { randomUUID } from "crypto";

interface DailyRoom {
  name: string;
  url: string;
}

/**
 * Creates a Daily room for a session. The room name is random (never derived
 * from the request id, which all teachers can see in the open feed), so the
 * URL is unguessable and only reaches the two participants via RLS. The room
 * self-expires shortly after the booked duration.
 */
export async function createDailyRoom(
  durationMinutes: number,
  startsAt: string
): Promise<DailyRoom> {
  const startMs = Math.max(Date.now(), new Date(startsAt).getTime());
  const res = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `lt-${randomUUID()}`,
      privacy: "public",
      properties: {
        exp: Math.floor(startMs / 1000) + (durationMinutes + 15) * 60,
        eject_at_room_exp: true,
        enable_screenshare: true,
        enable_chat: true,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Daily room creation failed (${res.status}): ${await res.text()}`);
  }

  const room = await res.json();
  return { name: room.name, url: room.url };
}

/** Push a room's expiry out (used when a session is extended). */
export async function extendDailyRoom(
  roomName: string,
  newExpEpochSeconds: number
): Promise<void> {
  const res = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { exp: newExpEpochSeconds } }),
  });
  if (!res.ok) {
    throw new Error(
      `Daily room extend failed (${res.status}): ${await res.text()}`
    );
  }
}
