import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Atomic claim: exactly one of two racing teachers gets the row. The video
  // room isn't created here — that happens when the student confirms the
  // match (POST /confirm), so a declined match never wastes a room.
  const { error } = await supabase.rpc("accept_request", {
    p_request_id: id,
  });
  if (error) {
    return NextResponse.json(
      { error: "Request no longer available" },
      { status: 409 }
    );
  }

  return NextResponse.json({ requestId: id });
}
