import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Server-side auth check. Redirects to /login if not authenticated. */
export async function requireAuth(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/** Look up the user's first workspace slug using service client (bypasses RLS). */
export async function getWorkspaceSlug(userId: string): Promise<string | null> {
  const supabase = createServiceClient();

  const { data: members } = await supabase
    .from("members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1);

  if (!members || members.length === 0) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", members[0].workspace_id)
    .single();

  return workspace?.slug ?? null;
}
