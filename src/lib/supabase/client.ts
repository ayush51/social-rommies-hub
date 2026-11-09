import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

type Client = ReturnType<typeof createBrowserClient<Database>>;
let real: Client | undefined;

// One shared browser client, built on first use. Client components are also rendered once on the server,
// and Supabase reads the clock when a client starts, which Next.js rejects during prerender. A lazy proxy
// means nothing is constructed until an event handler or effect actually uses it in the browser.
export const createClient = (): Client =>
  new Proxy({} as Client, {
    get(_, prop) {
      real ??= createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const value = Reflect.get(real, prop);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
