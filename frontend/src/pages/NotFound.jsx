import React from "react";
import { t } from "../i18n/index.js";

export default function NotFound() {
  return (
    <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-600">
      {t("generic.notFound")}
    </div>
  );
}
