import { createClient } from "@/lib/supabase/server";
import { getWorkspaceSlug } from "@/lib/auth";
import LandingContent from "./LandingContent";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dashboardHref: string | null = null;
  if (user) {
    const slug = await getWorkspaceSlug(user.id);
    dashboardHref = slug ? `/workspace/${slug}` : "/setup";
  }

  return <LandingContent dashboardHref={dashboardHref} />;
}
