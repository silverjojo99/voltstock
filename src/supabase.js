import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;

export function getProductPhotoUrl(path) {
  if (!path || !supabase) return null;
  return supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl;
}
