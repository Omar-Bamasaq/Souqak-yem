import React from "react";
import { PublicPrivacyContent } from "../ssg/PublicLegalContent.mjs";
import PublicPageSEO from "../components/PublicPageSEO.jsx";
import { useSsgData } from "../ssg/SsgDataContext.jsx";

export default function Privacy() {
  const ssgData = useSsgData();
  const lastUpdated = ssgData?.kind === "static-page" && ssgData.data?.path === "/privacy"
    ? ssgData.data.lastUpdated
    : new Date().toLocaleDateString("ar-YE");
  return (
    <>
      <PublicPageSEO path="/privacy" />
      <PublicPrivacyContent lastUpdated={lastUpdated} />
    </>
  );
}
