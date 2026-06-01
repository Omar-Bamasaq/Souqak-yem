import React from "react";
import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-slate-950">
      <main className="min-h-screen flex items-center justify-center">
        <Outlet />
      </main>
    </div>
  );
}

