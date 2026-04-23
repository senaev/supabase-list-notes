import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Signal } from 'senaev-utils/src/utils/Signal/Signal';

import { NOTES_LIST_TABLE_NAME } from '../const/NOTES_LIST_TABLE_NAME';
import { SUPABASE_CREDENTIALS_QUERY_PARAMS } from '../const/SUPABASE_CREDENTIALS_QUERY_PARAMS';

export type SupabaseClientSignal = Signal<SupabaseClient | undefined>;

export type SupabaseCredentials = {
    projectUrl: string;
    publishableKey: string;
};

type SupabaseControllerAuthenticateFunction = (
    credentials: SupabaseCredentials,
) => Promise<void>;

export type SupabaseControllerStatusObjectNotReady =
  | {
      status: 'wrong-credentials';
      authenticate: SupabaseControllerAuthenticateFunction;
      message: string;
      clientSignal: SupabaseClientSignal;
  }
  | {
      status: 'require-credentials';
      authenticate: SupabaseControllerAuthenticateFunction;
      clientSignal: SupabaseClientSignal;
  };

export type SupabaseControllerStatusObjectInitialization = {
    status: 'initialization';
    clientSignal: SupabaseClientSignal;
};

export type SupabaseControllerStatusObjectReady = {
    status: 'ready';
    clientSignal: SupabaseClientSignal;
    credentials: SupabaseCredentials;
    logout: VoidFunction;
};

export type SupabaseControllerStatus =
  | SupabaseControllerStatusObjectInitialization
  | SupabaseControllerStatusObjectNotReady
  | SupabaseControllerStatusObjectReady;

const LOCAL_STORAGE_KEY = 'supabase-credentials';

function parseLocalStorageCredentials(value: string | null): SupabaseCredentials | null {
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value);

        const { projectUrl, publishableKey } = parsed;

        if (typeof projectUrl === 'string' && typeof publishableKey === 'string') {
            return {
                projectUrl,
                publishableKey,
            };
        }
    } catch (_error) {
    //
    }

    return null;
}

export class SupabaseController {
    public readonly clientSignal: SupabaseClientSignal = new Signal<SupabaseClient | undefined>(undefined);

    public readonly statusSignal = new Signal<SupabaseControllerStatus>({
        status: 'initialization',
        clientSignal: this.clientSignal,
    });

    public constructor() {
        const localStorageCredentials = localStorage.getItem(LOCAL_STORAGE_KEY);

        let credentials: SupabaseCredentials | null = null;

        try {
            credentials = parseLocalStorageCredentials(localStorageCredentials);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
                'Failed to parse Supabase credentials from localStorage:',
                error
            );
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }

        const { searchParams } = new URL(window.location.href);
        const hasAllRequiredCredentialsInUrl = Object.values(SUPABASE_CREDENTIALS_QUERY_PARAMS).every((param) => searchParams.has(param));

        if (hasAllRequiredCredentialsInUrl) {
            const credentialsFromUrl: Partial<SupabaseCredentials> = {};

            Object.entries(SUPABASE_CREDENTIALS_QUERY_PARAMS).forEach(([
                credentialKey,
                queryParam,
            ]) => {
                const paramValue = searchParams.get(queryParam);

                if (paramValue) {
                    credentialsFromUrl[credentialKey as keyof SupabaseCredentials] = paramValue;
                }
            });

            // Remove all query parameters without reloading the page
            const url = new URL(window.location.href);

            url.search = '';
            window.history.replaceState({}, document.title, url);

            credentials = credentialsFromUrl as SupabaseCredentials;
        }

        if (!credentials) {
            this.statusSignal.next({
                status: 'require-credentials',
                authenticate: this.authenticate,
                clientSignal: this.clientSignal,
            });

            return;
        }

        this.authenticate(credentials);
    }

    private destroyOldClient(): void {
        const oldClient = this.clientSignal.value();

        if (oldClient) {
            oldClient.removeAllChannels();
            this.clientSignal.next(undefined);
        }
    }

    private authenticate: SupabaseControllerAuthenticateFunction = async (credentials) => {
        this.destroyOldClient();

        const nextClient = createClient(
            credentials.projectUrl,
            credentials.publishableKey
        );

        const { error } = await nextClient
            .from(NOTES_LIST_TABLE_NAME)
            .select('id')
            .limit(1);

        if (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to authenticate with Supabase:', error);
            this.statusSignal.next({
                status: 'wrong-credentials',
                authenticate: this.authenticate,
                message: error.message,
                clientSignal: this.clientSignal,
            });

            return;
        }

        this.statusSignal.next({
            status: 'ready',
            clientSignal: this.clientSignal,
            credentials,
            logout: this.logout,
        });
        this.clientSignal.next(nextClient);

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(credentials));
    };

    private readonly logout: VoidFunction = () => {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        this.destroyOldClient();
        this.statusSignal.next({
            status: 'require-credentials',
            authenticate: this.authenticate,
            clientSignal: this.clientSignal,
        });
    };
}
