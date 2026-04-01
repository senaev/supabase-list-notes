import "./AuthPage.css";

import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { type FormEvent, useState } from "react";
import { SQL_SCHEMA_IMPORT_PROMISE } from "../../const/SQL_SCHEMA_IMPORT_PROMISE";
import { SUPABASE_DASHBOARD_LINK } from "../../const/SUPABASE_DASHBOARD_LINK";
import { SUPABASE_SQL_REQUEST_LINK } from "../../const/SUPABASE_SQL_REQUEST_LINK";
import { SupabaseClientStatusObjectNotReady } from "../../contexts/SupabaseClientContext";
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
  statusObject: SupabaseClientStatusObjectNotReady;
}) {
  const [copyStatus, setCopyStatus] = useState<ClipboardStatus>("idle");
  const [projectUrl, setProjectUrl] = useState("");
  const [publishableKey, setPublishableKey] = useState("");

  function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    localStorage.setItem(
      "supabase-credentials",
      JSON.stringify({
        supabaseUrl: projectUrl,
        supabaseKey: publishableKey,
      }),
    );
    window.location.reload();
  }

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
      <form onSubmit={saveCredentials} className="AuthPage__instruction">
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
            onSubmit={(event) => {
              event.preventDefault();
              console.log({
                projectUrl,
                publishableKey,
              });
            }}
          >
            Login
          </button>
        </section>
      </form>
    </>
  );
}
