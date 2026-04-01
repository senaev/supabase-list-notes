import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type SupabaseCredentials = {
  projectUrl: string;
  publishableKey: string;
};

export type SupabaseControllerStatusObjectNotReady = {
  status: "require-credentials" | "check-credentials" | "wrong-credentials";
};

export type SupabaseControllerStatusObjectReady = {
  status: "ready";
  client: SupabaseClient;
};

export type SupabaseControllerStatus =
  | SupabaseControllerStatusObjectNotReady
  | SupabaseControllerStatusObjectReady;

export const SUPABASE_CONTROLLER_STATUS_REQUIRE_CREDENTIALS = {
  status: "require-credentials",
} as const;

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
    SUPABASE_CONTROLLER_STATUS_REQUIRE_CREDENTIALS;
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

    if (!credentials) {
      return;
    }

    this.authenticate(credentials);
  }

  private async authenticate(credentials: SupabaseCredentials): Promise<void> {
    this.client = createClient(
      credentials.projectUrl,
      credentials.publishableKey,
    );

    this.status = {
      status: "check-credentials",
    };
    this.params.onChange();

    const { data, error } = await this.client.auth.getUser();

    if (error || !data.user) {
      this.status = {
        status: "wrong-credentials",
      };
      this.params.onChange();
      return;
    }

    this.status = {
      status: "ready",
      client: this.client,
    };
    this.params.onChange();
  }
}
