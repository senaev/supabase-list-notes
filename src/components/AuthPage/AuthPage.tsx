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
import { SupabaseClientStatusObjectNotReady } from "../../contexts/SupabaseClientContext";
import { MainPageHeader } from "../MainPageHeader/MainPageHeader";

const CLIPBOARD_STATUS_ICONS = {
  idle: <ClipboardDocumentListIcon />,
  success: <ClipboardDocumentCheckIcon />,
  error: <NoSymbolIcon />,
};

type ClipboardStatus = keyof typeof CLIPBOARD_STATUS_ICONS;

export function AuthPage({
  statusObject,
}: {
  statusObject: SupabaseClientStatusObjectNotReady;
}) {
  const [copyStatus, setCopyStatus] = useState<ClipboardStatus>("idle");
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
      <section className="AuthPage__instruction">
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
    </>
  );
}
