import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./components/App/App";
import { ToastsContextProvider } from "./contexts/ToastsContext";
import "./index.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <HashRouter>
      <ToastsContextProvider>
        <App />
      </ToastsContextProvider>
    </HashRouter>
  </React.StrictMode>,
);
