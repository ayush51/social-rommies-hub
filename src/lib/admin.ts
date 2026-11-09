import { notFound } from "next/navigation";
import { getMe } from "@/lib/session";

// Call first in every admin page: layouts render in parallel with pages, so a layout gate alone doesn't stop data fetching.
export async function requireAdmin() {
  const me = await getMe();
  if (!me.isAdmin) notFound();
  return me;
}
