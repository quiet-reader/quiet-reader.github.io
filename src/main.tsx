import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import "@/styles/tokens.css";
import "@/styles/global.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root application mount.");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);