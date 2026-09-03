import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

import { ITEMS_TABLE_NAME } from '../../src/const/ITEMS_TABLE_NAME';
import type { SupabaseCredentials } from '../../src/controllers/SupabaseController';
import type { LocalItemRow } from '../../src/sync/localDb';

/**
 * Reads the same `.env` files Vite feeds to the app, so tests never carry
 * a hardcoded project URL or key. Real environment variables win, which is
 * how CI passes them in (see .github/workflows/deploy-github-pages.yml).
 */
function getCredentials(): SupabaseCredentials {
    const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env };
    const projectUrl = env.VITE_SUPABASE_PROJECT_URL;
    const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!projectUrl || !publishableKey) {
        throw new Error(
            'remoteItems: VITE_SUPABASE_PROJECT_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required - copy .env.example to .env'
        );
    }

    return { projectUrl, publishableKey };
}

let cachedClient: SupabaseClient | undefined;

function getClient(): SupabaseClient {
    if (!cachedClient) {
        const { projectUrl, publishableKey } = getCredentials();

        cachedClient = createClient(projectUrl, publishableKey);
    }

    return cachedClient;
}

function unwrapRows(data: unknown, error: PostgrestError | null): LocalItemRow[] {
    if (error) {
        // Only the message is reported, never the request itself, which
        // carries the publishable key and can end up in CI logs.
        throw new Error(`remoteItems: read failed - ${error.message}`);
    }

    return (data ?? []) as LocalItemRow[];
}

// Only selects are exposed, so nothing reachable from a test can write to
// or delete from the Supabase project it runs against.
export async function getRemoteItems(): Promise<LocalItemRow[]> {
    const { data, error } = await getClient()
        .from(ITEMS_TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: true });

    return unwrapRows(data, error);
}

export async function getRemoteItemById(id: string): Promise<LocalItemRow | undefined> {
    const { data, error } = await getClient().from(ITEMS_TABLE_NAME).select('*').eq('id', id);

    return unwrapRows(data, error)[0];
}
