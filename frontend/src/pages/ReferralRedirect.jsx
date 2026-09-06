import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../api/axios.js";

export default function ReferralRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  useEffect(() => {
    api.get(`/referrals/visit/${encodeURIComponent(code || "")}`)
      .catch(() => null)
      .finally(() => navigate("/", { replace: true }));
  }, [code]);

  return <main dir="rtl" className="flex min-h-[50vh] items-center justify-center p-6 text-slate-600">جارٍ تجهيز رابط الدعوة...</main>;
}