import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getAppSession();
  redirect(session ? "/en/dashboard" : "/en/sign-in");
}
