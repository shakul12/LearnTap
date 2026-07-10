import { NextResponse } from "next/server";
import { createDailyRoom } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest } from "@/lib/types";

// The student confirms their matched teacher: create the video room and mark
// the request confirmed. Until this runs the match is provisional — the
// student can still decline and continue searching.
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

  const { data: request } = await supabase
    .from("help_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle<HelpRequest>();

  if (
    !request ||
    request.student_id !== user.id ||
    request.status !== "matched" ||
    request.confirmed_at
  ) {
    return NextResponse.json(
      { error: "Match not confirmable" },
      { status: 409 }
    );
  }

  let room: { name: string; url: string };
  try {
    room = await createDailyRoom(request.duration_minutes, request.starts_at);
  } catch (err) {
    console.error("Failed to create session room:", err);
    // The match stays intact — the student can tap "Go ahead" again.
    return NextResponse.json(
      { error: "Could not create the session room" },
      { status: 500 }
    );
  }

  // Conditional update so a concurrent decline/cancel can't be overwritten.
  const admin = createAdminClient();
  const { data: updated, error: updateError } = await admin
    .from("help_requests")
    .update({
      confirmed_at: new Date().toISOString(),
      daily_room_name: room.name,
      daily_room_url: room.url,
      started_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "matched")
    .is("confirmed_at", null)
    .select()
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Match no longer available" },
      { status: 409 }
    );
  }

  return NextResponse.json({ requestId: id });
}
