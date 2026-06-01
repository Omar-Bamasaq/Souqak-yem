import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { t } from "../i18n/index.js";

export default function Pricing() {
  const api = useApi();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [ads, setAds] = useState([]);
  const [selectedAd, setSelectedAd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const res = await api.get("/plans");
    setPlans(res.data);
    if (user) {
      const my = await api.get("/ads/my?status=approved");
      setAds(my.data || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subscribe = async (plan) => {
    setMsg("");
    setErr("");
    try {
      if (!user) {
        setErr("قم بتسجيل الدخول للمتابعة");
        return;
      }
      const payload = { planId: plan._id };
      if (plan.type === "featured") {
        if (!selectedAd) {
          setErr("يجب اختيار إعلان");
          return;
        }
        payload.productId = selectedAd;
      }
      await api.post("/purchase-requests", payload);
      setMsg(t("pricing.requestActivated"));
    } catch {
      setErr(t("pricing.requestError"));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="ds-title">{t("pricing.title")}</h1>
      {msg && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}
      {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="ds-grid">
        {plans.map((p) => (
          <div key={p._id} className="ds-card">
            <div className="text-sm font-semibold">{p.name}</div>
            <div className="mt-1 text-xs text-gray-600">النوع: {p.type === "verification" ? t("pricing.typeVerification") : t("pricing.typeFeatured")}</div>
            <div className="mt-1 text-xs text-gray-600">المدة: {p.durationInDays} يوم</div>
            <div className="mt-3">
              {p.type === "featured" && (
                <select className="ds-select" value={selectedAd} onChange={(e) => setSelectedAd(e.target.value)}>
                  <option value="">اختيار الإعلان</option>
                  {ads.map((ad) => (
                    <option key={ad._id} value={ad._id}>{ad.title}</option>
                  ))}
                </select>
              )}
            </div>
            <button className="ds-btn-primary mt-3 w-full" onClick={() => subscribe(p)}>
              {t("pricing.subscribeNow")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
