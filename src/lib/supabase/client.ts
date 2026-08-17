/**
 * supabase/client.ts — the Supabase connection used inside the BROWSER.
 *
 * Plain English: when a page runs in the visitor's browser (a "client
 * component") and needs to log someone in or read data, it uses this.
 * It only ever uses the public key, so nothing secret leaks.
 */

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "@/lib/env";

export function createClient() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient(url, key);
}
