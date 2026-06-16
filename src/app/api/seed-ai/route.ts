import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const AI_PLAYERS = [
  { email: "ai-claude@worldcupbets.internal", name: "Claude", model: "claude" },
  { email: "ai-grok@worldcupbets.internal", name: "Grok", model: "grok" },
  { email: "ai-gemini@worldcupbets.internal", name: "Gemini", model: "gemini" },
  { email: "ai-deepseek@worldcupbets.internal", name: "DeepSeek", model: "deepseek" },
];

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  const results: string[] = [];

  try {
    // Get or create AI workspace
    const { data: existingWorkspace } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", "ai-players")
      .single();

    let workspaceId: string;

    if (existingWorkspace) {
      workspaceId = existingWorkspace.id;
      results.push("workspace: already exists");
    } else {
      // Need a created_by user — use the requesting user as owner
      const { data: ws, error } = await admin
        .from("workspaces")
        .insert({ name: "AI Players", slug: "ai-players", created_by: user.id })
        .select("id")
        .single();
      if (error) throw new Error(`Create workspace: ${error.message}`);
      workspaceId = ws.id;
      results.push("workspace: created");
    }

    // Get existing auth users by email
    const {
      data: { users: allUsers },
    } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailToId = new Map(allUsers.map((u) => [u.email, u.id]));

    for (const p of AI_PLAYERS) {
      let userId = emailToId.get(p.email);

      if (!userId) {
        const { data, error } = await admin.auth.admin.createUser({
          email: p.email,
          email_confirm: true,
          user_metadata: { display_name: p.name },
        });
        if (error) throw new Error(`Create user ${p.name}: ${error.message}`);
        userId = data.user.id;
        results.push(`${p.name}: user created`);
      } else {
        results.push(`${p.name}: user exists`);
      }

      // Get or create member row
      const { data: existingMember } = await admin
        .from("members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .single();

      if (!existingMember) {
        const { error } = await admin.from("members").insert({
          workspace_id: workspaceId,
          user_id: userId,
          display_name: p.name,
          is_ai: true,
          ai_model: p.model,
          is_global: true,
          points: 0,
        });
        if (error) throw new Error(`Create member ${p.name}: ${error.message}`);
        results.push(`${p.name}: member created`);
      } else {
        results.push(`${p.name}: member exists`);
      }
    }

    return NextResponse.json({ status: "ok", results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", error: message, results }, { status: 500 });
  }
}
