import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/local/auth";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  redirect(profile ? "/app" : "/login");
}
