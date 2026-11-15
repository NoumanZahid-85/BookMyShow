import { redirect } from "next/navigation";

/** Live operations moved into the single admin dashboard. */
export default function LiveOpsPage() {
  redirect("/admin");
}
