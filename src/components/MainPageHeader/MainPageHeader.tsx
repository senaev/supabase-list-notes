import "./MainPageHeader.css";

import { PlusCircleIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { APP_BASE_URL } from "../../const/APP_BASE_URL";
import { APP_TITLE } from "../../const/APP_TITLE";
import { PageHeader } from "../PageHeader/PageHeader";

export const APP_LOGO_URL = `${APP_BASE_URL}logo.svg`;

export function MainPageHeader({
  createNewNote,
  menu,
}: {
  createNewNote?: VoidFunction;
  menu?: ReactNode;
}) {
  return (
    <PageHeader
      homeButtonIcon={
        <img className="MainPageHeader__logo" src={APP_LOGO_URL} alt="Home" />
      }
    >
      <h1 className="MainPageHeader__appTitle">{APP_TITLE}</h1>
      {createNewNote ? (
        <button type="button" aria-label="Add note" onClick={createNewNote}>
          <PlusCircleIcon className="MainPageHeader__icon" />
        </button>
      ) : null}
      {menu}
    </PageHeader>
  );
}
