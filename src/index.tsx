import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./components/App/App";
import { ToastsContextProvider } from "./contexts/ToastsContext";
import "./index.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastsContextProvider>
        <App />
      </ToastsContextProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
