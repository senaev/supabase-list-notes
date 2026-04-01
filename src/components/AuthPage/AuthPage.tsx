import "./AuthPage.css";

import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { SQL_SCHEMA_IMPORT_PROMISE } from "../../const/SQL_SCHEMA_IMPORT_PROMISE";
import { SUPABASE_DASHBOARD_LINK } from "../../const/SUPABASE_DASHBOARD_LINK";
import { SUPABASE_SQL_REQUEST_LINK } from "../../const/SUPABASE_SQL_REQUEST_LINK";
import { useErrorsContext } from "../../contexts/ErrorsContext";
import {
  SupabaseControllerStatusObjectNotReady,
  SupabaseCredentials,
} from "../../controllers/SupabaseController";
import { MainPageHeader } from "../MainPageHeader/MainPageHeader";

const CLIPBOARD_STATUS_ICONS = {
  idle: <ClipboardDocumentListIcon />,
  success: <ClipboardDocumentCheckIcon />,
  error: <NoSymbolIcon />,
};

type ClipboardStatus = keyof typeof CLIPBOARD_STATUS_ICONS;

const PROJECT_URL_PLACEHOLDER = "https://xxxxxxxxxxxxxxxxxxxx.supabase.co";
const PUBLISHABLE_KEY_PLACEHOLDER =
  "sb_publishable_XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXX";

export function AuthPage({
  statusObject,
}: {
  statusObject: SupabaseControllerStatusObjectNotReady;
}) {
  const [copyStatus, setCopyStatus] = useState<ClipboardStatus>("idle");
  const [projectUrl, setProjectUrl] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const { showError } = useErrorsContext();

  function copySqlRequestToClipboard() {
    SQL_SCHEMA_IMPORT_PROMISE.then((sqlRequest) => {
      return navigator.clipboard.writeText(sqlRequest);
    })
      .then(() => {
        setCopyStatus("success");
      })
      .catch((error) => {
        console.error("Failed to copy SQL request to clipboard:", error);
        setCopyStatus("error");
      })
      .finally(() => {
        setTimeout(() => {
          setCopyStatus("idle");
        }, 2000);
      });
  }

  return (
    <>
      <MainPageHeader />
      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (!projectUrl || !publishableKey) {
            showError("Both project URL and publishable key are required.");
            return;
          }

          const nextCredentials: SupabaseCredentials = {
            projectUrl,
            publishableKey,
          };

          statusObject.authenticate(nextCredentials).catch((error) => {
            showError(
              "Failed to authenticate with provided credentials. Please check them and try again.",
            );
          });
        }}
        className="AuthPage__instruction"
      >
        <section>
          <h3>1. Create database</h3>
          <p>
            Log in to your Supabase account and create a new project on{" "}
            <a
              href={SUPABASE_DASHBOARD_LINK}
              target="_blank"
              rel="noopener noreferrer"
            >
              dashboard
            </a>
            .
          </p>
          <p>
            Create tables using the{" "}
            <a
              href={SUPABASE_SQL_REQUEST_LINK}
              target="_blank"
              rel="noopener noreferrer"
            >
              SQL request
            </a>
            .
            <button
              className="AuthPage__copyButton"
              onClick={copySqlRequestToClipboard}
            >
              {CLIPBOARD_STATUS_ICONS[copyStatus]}
            </button>
          </p>
        </section>
        <section>
          <h3>2. Input credentials</h3>
          {statusObject.status === "wrong-credentials" && (
            <p className="AuthPage__wrongCredentialsMessage">
              Invalid credentials ({statusObject.message}). Please enter a valid
              project URL and publishable key.
            </p>
          )}
          <div className="AuthPage__credentialsInputs">
            <label className="AuthPage__field">
              <span>Project URL</span>
              <input
                type="url"
                name="projectUrl"
                placeholder={PROJECT_URL_PLACEHOLDER}
                value={projectUrl}
                onChange={(event) => {
                  setProjectUrl(event.target.value);
                }}
                required
              />
            </label>
            <label className="AuthPage__field">
              <span>Publishable key</span>
              <input
                type="password"
                name="publishableKey"
                placeholder={PUBLISHABLE_KEY_PLACEHOLDER}
                value={publishableKey}
                onChange={(event) => {
                  setPublishableKey(event.target.value);
                }}
                required
              />
            </label>
          </div>
          <button
            className="AuthPage__submitButton"
            type="submit"
            disabled={!projectUrl || !publishableKey}
          >
            Login
          </button>
        </section>
      </form>
    </>
  );
}
