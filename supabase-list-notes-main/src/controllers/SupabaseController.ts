import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NOTES_LIST_TABLE_NAME } from "../const/NOTES_LIST_TABLE_NAME";
import { SUPABASE_CREDENTIALS_QUERY_PARAMS } from "../const/SUPABASE_CREDENTIALS_QUERY_PARAMS";

export type SupabaseCredentials = {
  projectUrl: string;
  publishableKey: string;
};

type SupabaseControllerAuthenticateFunction = (
  credentials: SupabaseCredentials,
) => Promise<void>;

export type SupabaseControllerStatusObjectNotReady =
  | {
      status: "wrong-credentials";
      authenticate: SupabaseControllerAuthenticateFunction;
      message: string;
    }
  | {
      status: "require-credentials";
      authenticate: SupabaseControllerAuthenticateFunction;
    };

export type SupabaseControllerStatusObjectInitialization = {
  status: "initialization";
};

export const SUPABASE_CONTROLLER_STATUS_INITIALIZATION: SupabaseControllerStatusObjectInitialization =
  {
    status: "initialization",
  };

export type SupabaseControllerStatusObjectReady = {
  status: "ready";
  client: SupabaseClient;
  credentials: SupabaseCredentials;
  logout: VoidFunction;
};

export type SupabaseControllerStatus =
  | SupabaseControllerStatusObjectInitialization
  | SupabaseControllerStatusObjectNotReady
  | SupabaseControllerStatusObjectReady;

const LOCAL_STORAGE_KEY = "supabase-credentials";

function parseLocalStorageCredentials(
  value: string | null,
): SupabaseCredentials | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    const { projectUrl, publishableKey } = parsed;
    if (typeof projectUrl === "string" && typeof publishableKey === "string") {
      return { projectUrl, publishableKey };
    }
  } catch (error) {
    //
  }

  return null;
}

export class SupabaseController {
  public status: SupabaseControllerStatus =
    SUPABASE_CONTROLLER_STATUS_INITIALIZATION;
  private client?: SupabaseClient;

  constructor(
    private readonly params: {
      onChange: VoidFunction;
    },
  ) {
    this.initialize();
  }

  private initialize() {
    const localStorageCredentials = localStorage.getItem(LOCAL_STORAGE_KEY);

    let credentials: SupabaseCredentials | null = null;
    try {
      credentials = parseLocalStorageCredentials(localStorageCredentials);
    } catch (error) {
      console.error(
        "Failed to parse Supabase credentials from localStorage:",
        error,
      );
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }

    const { searchParams } = new URL(window.location.href);
    const hasAllRequiredCredentialsInUrl = Object.values(
      SUPABASE_CREDENTIALS_QUERY_PARAMS,
    ).every((param) => searchParams.has(param));

    if (hasAllRequiredCredentialsInUrl) {
      const credentialsFromUrl: Partial<SupabaseCredentials> = {};
      Object.entries(SUPABASE_CREDENTIALS_QUERY_PARAMS).forEach(
        ([credentialKey, queryParam]) => {
          const paramValue = searchParams.get(queryParam);
          if (paramValue) {
            credentialsFromUrl[credentialKey as keyof SupabaseCredentials] =
              paramValue;
          }
        },
      );

      // Remove all query parameters without reloading the page
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, document.title, url);

      credentials = credentialsFromUrl as SupabaseCredentials;
    }

    if (!credentials) {
      this.status = {
        status: "require-credentials",
        authenticate: this.authenticate,
      };
      this.params.onChange();
      return;
    }

    this.authenticate(credentials);
  }

  private authenticate: SupabaseControllerAuthenticateFunction = async (
    credentials,
  ) => {
    this.client = createClient(
      credentials.projectUrl,
      credentials.publishableKey,
    );

    const { error } = await this.client
      .from(NOTES_LIST_TABLE_NAME)
      .select("id")
      .limit(1);

    if (error) {
      console.error("Failed to authenticate with Supabase:", error);
      this.status = {
        status: "wrong-credentials",
        authenticate: this.authenticate,
        message: error.message,
      };
      this.params.onChange();
      return;
    }

    this.status = {
      status: "ready",
      client: this.client,
      credentials,
      logout: this.logout,
    };
    this.params.onChange();

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(credentials));
  };

  private readonly logout: VoidFunction = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    this.status = {
      status: "require-credentials",
      authenticate: this.authenticate,
    };
    this.params.onChange();
  };
}
