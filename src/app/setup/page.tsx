import { redirect } from "next/navigation";
import { requireAuth, getWorkspaceSlug } from "@/lib/auth";
import SetupForm from "./SetupForm";

export default async function SetupPage() {
  const user = await requireAuth();
  const slug = await getWorkspaceSlug(user.id);

  if (slug) {
    redirect(`/workspace/${slug}`);
  }

  return <SetupForm userId={user.id} />;
}
