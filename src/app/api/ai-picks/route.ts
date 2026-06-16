import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAiPicks } from "@/lib/ai-picks";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { model } = await request.json().catch(() => ({}));
  const count = await generateAiPicks(model ?? undefined);
  return NextResponse.json({ status: "ok", picks: count });
}
