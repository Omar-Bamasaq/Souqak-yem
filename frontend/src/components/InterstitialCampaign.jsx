import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";

function getStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn("Interstitial frequency preference could not be read:", error);
    return null;
  }
}

function setStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Interstitial frequency preference could not be saved:", error);
  }
}

export default function InterstitialCampaign() {
  const api = useApi();
  const { user, loading } = useAuth();
  const location = useLocation();
  const [campaign, setCampaign] = useState(null);
  const userId = user?._id || user?.id || "visitor";
  const allowedRoute = location.pathname === "/"
    || location.pathname === "/search"
    || location.pathname.startsWith("/category/");

  useEffect(() => {
    if (loading) return undefined;
    if (!allowedRoute) {
      setCampaign(null);
      return undefined;
    }
    let cancelled = false;
    let timeoutId;
    const checkedKey = "souqak_interstitial_checked_session";
    try {
      if (window.sessionStorage.getItem(checkedKey)) return undefined;
    } catch (error) {
      console.warn("Interstitial session preference could not be read:", error);
    }

    api.get("/purchase-requests/campaigns", { params: { type: "interstitial" } })
      .then(async ({ data }) => {
        if (cancelled) return;
        const candidate = data?.[0];
        if (!candidate?._id || !candidate.product?._id || !candidate.product.image) return;

        const frequencyKey = user && userId !== "visitor"
          ? `souqak_interstitial_${userId}_${candidate._id}`
          : `souqak_interstitial_visitor_${candidate._id}`;
        const lastShown = Number(getStorage(frequencyKey) || 0);
        const capMs = Math.max(1, Number(candidate.frequencyCapHours) || 24) * 60 * 60 * 1000;
        if (lastShown && Date.now() - lastShown < capMs) return;

        timeoutId = window.setTimeout(async () => {
          try {
            await api.post(`/purchase-requests/campaigns/${candidate._id}/impression`);
            if (cancelled) return;
            setStorage(frequencyKey, String(Date.now()));
            if (!user || userId === "visitor") {
              try {
                window.sessionStorage.setItem(frequencyKey, String(Date.now()));
              } catch (error) {
                console.warn("Interstitial visitor preference could not be saved for this session:", error);
              }
            }
            try {
              window.sessionStorage.setItem(checkedKey, "1");
            } catch (error) {
              console.warn("Interstitial session preference could not be saved:", error);
            }
            setCampaign(candidate);
          } catch (error) {
            if (error.response?.status !== 404 && error.response?.status !== 429) {
              console.error("Failed to confirm interstitial campaign eligibility:", error);
            }
          }
        }, Math.max(0, Number(candidate.delaySeconds) || 0) * 1000);
      })
      .catch((error) => {
        console.error("Failed to load interstitial campaign:", error);
      });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [allowedRoute, api, loading, user, userId]);

  if (!campaign || !allowedRoute) return null;
  const close = () => setCampaign(null);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="إعلان ممول">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900" dir="rtl">
        <button
          type="button"
          onClick={close}
          className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-4 py-2 text-xs font-black text-white"
          aria-label="إغلاق الإعلان"
        >
          إغلاق الإعلان ×
        </button>
        <Link to={`/ad/${campaign.product._id}`} onClick={close} className="block">
          <img
            src={uploadsUrl(campaign.product.image, "med")}
            alt={campaign.product.title}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] max-h-[55vh] w-full object-cover"
          />
          <div className="space-y-3 p-5">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              إعلان ممول
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{campaign.product.title}</h2>
            <span className="block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white">
              عرض الإعلان
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}
