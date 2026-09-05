import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { AuthProvider } from "./store/AuthContext.jsx";
import { ChatProvider } from "./store/ChatContext.jsx";
import { ThemeProvider } from "./store/ThemeContext.jsx";
import { BrokerageStatusProvider } from "./store/BrokerageStatusContext.jsx";
import "./index.css";

const PRELOAD_RECOVERY_KEY = "souqak-preload-recovery";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (sessionStorage.getItem(PRELOAD_RECOVERY_KEY) === "1") return;
  sessionStorage.setItem(PRELOAD_RECOVERY_KEY, "1");
  window.location.reload();
});

window.addEventListener("load", () => {
  sessionStorage.removeItem(PRELOAD_RECOVERY_KEY);
});

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

createRoot(document.getElementById("root")).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <BrokerageStatusProvider>
                <App />
              </BrokerageStatusProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </BrowserRouter>
);

// Keep the development server and HMR independent from the production PWA worker.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    if (import.meta.env.PROD) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered:", registration);
      } catch (error) {
        console.log("SW registration failed:", error);
      }
      return;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });
}
