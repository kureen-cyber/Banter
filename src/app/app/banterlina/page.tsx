import { redirect } from "next/navigation";
import { BanterlinaChat } from "@/components/banterlina-chat";
import { requireUser } from "@/lib/data";
import { listBanterlinaMessages } from "@/lib/banterlina";

export default async function BanterlinaPage() {
  const { user } = await requireUser();
  if (!user) redirect("/login");

  const messages = await listBanterlinaMessages(user.id);

  return <BanterlinaChat initialMessages={messages} />;
}
