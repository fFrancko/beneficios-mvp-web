// app/app/page.tsx (Server Component)
import { redirect } from "next/navigation";

export default function AppIndex() {
  redirect("/app/member");
}
