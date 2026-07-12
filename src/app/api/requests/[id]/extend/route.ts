import { NextResponse } from "next/server";
import { extendDailyRoom } from "@/lib/daily";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest } from "@/lib/types";

// Student extends a running session by 15 minutes. The DB function enforces
// who/when; billing follows automatically (cost derives from duration at
// completion). The Daily room expiry moves out to match.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("extend_session", {
    p_request_id: id,
  });
  if (error) {
    return NextResponse.json(
      { error: "Session can no longer be extended" },
      { status: 409 }
    );
  }
  const request = data as HelpRequest;

  if (request.daily_room_name) {
    const anchorMs = Math.max(
      new Date(request.starts_at).getTime(),
      request.started_at ? new Date(request.started_at).getTime() : 0
    );
    const exp =
      Math.floor(anchorMs / 1000) + (request.duration_minutes + 15) * 60;
    try {
      await extendDailyRoom(request.daily_room_name, exp);
    } catch (err) {
      // The DB extension already applied; worst case the room closes at the
      // old expiry. Log it rather than failing the user's extension.
      console.error("Daily room extend failed:", err);
    }
  }

  return NextResponse.json({ request });
}
