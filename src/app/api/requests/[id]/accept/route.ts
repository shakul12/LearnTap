import { NextResponse } from "next/server";
import { createDailyRoom } from "@/lib/daily";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest } from "@/lib/types";

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

  // Atomic claim: exactly one of two racing teachers gets the row.
  const { data, error } = await supabase.rpc("accept_request", {
    p_request_id: id,
  });
  if (error) {
    return NextResponse.json(
      { error: "Request no longer available" },
      { status: 409 }
    );
  }
  const request = data as HelpRequest;

  const admin = createAdminClient();
  try {
    const room = await createDailyRoom(request.duration_minutes);
    const { error: updateError } = await admin
      .from("help_requests")
      .update({
        daily_room_name: room.name,
        daily_room_url: room.url,
        started_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateError) throw updateError;
  } catch (err) {
    console.error("Failed to set up session room:", err);
    // Roll the request back to open so another teacher can take it.
    await admin
      .from("help_requests")
      .update({
        status: "open",
        accepted_teacher_id: null,
        accepted_at: null,
        rate_cents_per_hour: null,
      })
      .eq("id", id);
    return NextResponse.json(
      { error: "Could not create the session room" },
      { status: 500 }
    );
  }

  return NextResponse.json({ requestId: id });
}
