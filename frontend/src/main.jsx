import React, { useEffect, useState } from "react";
import axios from "axios";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { IS_MAINTENANCE } from "./config/maintenance.js";
import { clearCsrfToken, ensureCsrfToken, isApiRequest, retryAfterCsrfFailure } from "./api/csrf.js";
import { AuthProvider } from "./store/AuthContext.jsx";
import { ChatProvider } from "./store/ChatContext.jsx";
import { ThemeProvider } from "./store/ThemeContext.jsx";
import { BrokerageStatusProvider } from "./store/BrokerageStatusContext.jsx";
import { PublicSsgContent } from "./ssg/PublicSsgContent.mjs";
import { SsgDataProvider } from "./ssg/SsgDataContext.jsx";
import { resolveSiteBaseUrl } from "./lib/siteUrl.js";
import { startPwaUpdateManager } from "./utils/pwaUpdate.js";
import "./utils/pwaInstall.js";
import "./index.css";

const publicSiteBaseUrl = resolveSiteBaseUrl(import.meta.env.PUBLIC_SITE_URL);
const publicApiOrigin = (import.meta.env.VITE_API_URL || "https://api.souqak-yem.com/api")
  .replace(/\/api\/?$/, "");

axios.interceptors.request.use(async (config) => {
  if (IS_MAINTENANCE) {
    console.warn("[Maintenance] Blocking API request:", config.url || config.baseURL || "unknown");
    return Promise.reject(new Error("MAINTENANCE_MODE_ACTIVE"));
  }
  const method = config.method?.toLowerCase();
  if (
    ["post", "put", "patch", "delete"].includes(method) &&
    isApiRequest(config)
  ) {
    config.headers["X-CSRF-Token"] = await ensureCsrfToken();
  }
  return config;
}, (error) => Promise.reject(error));
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.data?.code === "CSRF_TOKEN_INVALID") {
      const retry = await retryAfterCsrfFailure(error, (config) => axios(config));
      if (retry) return retry;
      clearCsrfToken();
    }
    return Promise.reject(error);
  }
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const appTree = (
  <BrowserRouter
    basename={window.__SOUQAK_STORE_PWA_APP__?.basePath}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <BrokerageStatusProvider>
                <SsgDataProvider value={window.__SOUQAK_SSG_DATA__}>
                  <App />
                </SsgDataProvider>
              </BrokerageStatusProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </BrowserRouter>
);

function SsgAppTransition({ ssgData, app }) {
  const [showSsg, setShowSsg] = useState(true);

  useEffect(() => {
    setShowSsg(false);
  }, []);

  return showSsg ? (
    <PublicSsgContent
      kind={ssgData.kind}
      data={ssgData.data}
      siteBaseUrl={publicSiteBaseUrl}
      apiOrigin={publicApiOrigin}
    />
  ) : app;
}

const rootElement = document.getElementById("root");
const ssgData = window.__SOUQAK_SSG_DATA__;

if (ssgData && rootElement?.childNodes.length) {
  hydrateRoot(rootElement, <SsgAppTransition ssgData={ssgData} app={appTree} />);
} else {
  createRoot(rootElement).render(appTree);
}

if (import.meta.env.PROD) {
  startPwaUpdateManager(__SOUQAK_BUILD_ID__);
} else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) =>
    Promise.all(registrations.map((registration) => registration.unregister()))
  );
}
