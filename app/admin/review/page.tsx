import { AdminReviewApp } from "@/components/studio/ExamStudioApp";
import { getAuthUser, isAdminUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }
  if (!(await isAdminUser(user))) {
    redirect("/studio");
  }

  return <AdminReviewApp />;
}
