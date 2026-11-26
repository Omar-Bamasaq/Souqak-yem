import React from "react";
import { PublicTermsContent } from "../ssg/PublicLegalContent.mjs";
import PublicPageSEO from "../components/PublicPageSEO.jsx";
import { useSsgData } from "../ssg/SsgDataContext.jsx";

export default function Terms() {
  const ssgData = useSsgData();
  const lastUpdated = ssgData?.kind === "static-page" && ssgData.data?.path === "/terms"
    ? ssgData.data.lastUpdated
    : new Date().toLocaleDateString("ar-YE");
  return (
    <>
      <PublicPageSEO path="/terms" />
      <PublicTermsContent lastUpdated={lastUpdated} />
    </>
  );
}
