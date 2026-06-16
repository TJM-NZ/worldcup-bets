/**
 * One-time seed: create the AI Players workspace + 4 AI user accounts.
 * Safe to re-run — checks before creating.
 *
 * Usage: npx tsx scripts/seed-ai-players.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=][^=]*)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // env vars already set via shell
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const AI_PLAYERS = [
  { email: "ai-claude@worldcupbets.internal", name: "Claude", model: "claude" },
  { email: "ai-grok@worldcupbets.internal", name: "Grok", model: "grok" },
  { email: "ai-gemini@worldcupbets.internal", name: "Gemini", model: "gemini" },
  { email: "ai-deepseek@worldcupbets.internal", name: "DeepSeek", model: "deepseek" },
];

async function getOrCreateUser(email: string, name: string): Promise<string> {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = users.find((u) => u.email === email);
  if (existing) {
    console.log(`  ✓ User exists: ${name} (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw new Error(`Failed to create user ${name}: ${error.message}`);
  console.log(`  + Created user: ${name} (${data.user.id})`);
  return data.user.id;
}

async function getOrCreateWorkspace(createdBy: string): Promise<string> {
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", "ai-players")
    .single();

  if (existing) {
    console.log(`  ✓ Workspace exists: AI Players (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name: "AI Players", slug: "ai-players", created_by: createdBy })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create AI workspace: ${error.message}`);
  console.log(`  + Created workspace: AI Players (${data.id})`);
  return data.id;
}

async function getOrCreateMember(
  workspaceId: string,
  userId: string,
  name: string,
  model: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (existing) {
    console.log(`  ✓ Member exists: ${name}`);
    return;
  }

  const { error } = await supabase.from("members").insert({
    workspace_id: workspaceId,
    user_id: userId,
    display_name: name,
    is_ai: true,
    ai_model: model,
    is_global: true,
    points: 0,
  });

  if (error) throw new Error(`Failed to create member ${name}: ${error.message}`);
  console.log(`  + Created member: ${name} (model: ${model})`);
}

async function main() {
  console.log("Seeding AI players...\n");

  // Create users first
  const userIds: string[] = [];
  for (const p of AI_PLAYERS) {
    const id = await getOrCreateUser(p.email, p.name);
    userIds.push(id);
  }

  // Create workspace (owned by first AI user)
  console.log("\nWorkspace:");
  const workspaceId = await getOrCreateWorkspace(userIds[0]);

  // Create members
  console.log("\nMembers:");
  for (let i = 0; i < AI_PLAYERS.length; i++) {
    await getOrCreateMember(workspaceId, userIds[i], AI_PLAYERS[i].name, AI_PLAYERS[i].model);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
