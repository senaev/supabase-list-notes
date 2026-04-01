import { SupabaseCredentials } from "../controllers/SupabaseController";

export const SUPABASE_CREDENTIALS_QUERY_PARAMS: Record<
  keyof SupabaseCredentials,
  string
> = {
  projectUrl: "pu",
  publishableKey: "pk",
};
