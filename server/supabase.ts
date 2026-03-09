import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || "";
const anon = process.env.SUPABASE_ANON_KEY || "";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  if (!client) client = createClient(url, anon);
  return client;
}

export type CloudStaff = {
  id: string;
  name: string;
  staffId: string;
  passkey: string;
  createdBy?: string | null;
  createdAt?: string | null;
};

export type CloudProduct = {
  id: string;
  name: string;
  price: number;
  cost?: number;
  barcode: string;
  category?: string | null;
  image?: string | null;
  quantity?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};
