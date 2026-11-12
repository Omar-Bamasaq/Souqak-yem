import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import {
  getActiveSponsoredCampaigns,
  getNextSponsoredCampaignIndex,
  getSponsoredRotationDelayMs
} from "../lib/sponsoredAds.js";

const CAMPAIGN_REFRESH_INTERVAL_MS = 60_000;

export default function SponsoredAdSlot({ position }) {
  const api = useApi();
  const [campaigns, setCampaigns] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const currentCampaignIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;
    let lastRequestedAt = 0;

    const loadCampaigns = async () => {
      if (requestInProgress || Date.now() - lastRequestedAt < 5_000) return;
      requestInProgress = true;
      lastRequestedAt = Date.now();
      try {
        const { data } = await api.get("/purchase-requests/campaigns", { params: { position } });
        if (!Array.isArray(data)) throw new Error("Invalid sponsored campaigns response");
        if (!cancelled) {
          const nextCampaigns = data.slice(0, 10);
          const selectedIndex = nextCampaigns.findIndex(({ _id }) => _id === currentCampaignIdRef.current);
          setCampaigns(nextCampaigns);
          setCurrentIndex(selectedIndex >= 0 ? selectedIndex : 0);
        }
      } catch (error) {
        console.error("Failed to load sponsored ad placement:", error);
      } finally {
        requestInProgress = false;
      }
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") loadCampaigns();
    };

    loadCampaigns();
    const refreshTimer = window.setInterval(refreshIfVisible, CAMPAIGN_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [api, position]);

  const activeCampaigns = useMemo(
    () => getActiveSponsoredCampaigns(campaigns, now),
    [campaigns, now]
  );
  const currentCampaign = activeCampaigns[currentIndex];
  currentCampaignIdRef.current = currentCampaign?._id || null;

  useEffect(() => {
    const nextEnd = activeCampaigns.reduce((earliest, campaign) => {
      const endsAt = Date.parse(campaign.endsAt);
      return endsAt < earliest ? endsAt : earliest;
    }, Number.POSITIVE_INFINITY);
    if (!Number.isFinite(nextEnd)) return undefined;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextEnd - Date.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [activeCampaigns, now]);

  useEffect(() => {
    if (currentIndex >= activeCampaigns.length) setCurrentIndex(0);
  }, [activeCampaigns.length, currentIndex]);

  useEffect(() => {
    if (activeCampaigns.length < 2 || paused || !currentCampaign) return undefined;
    const timer = window.setTimeout(() => {
      setCurrentIndex((index) => getNextSponsoredCampaignIndex(index + 1, activeCampaigns.length));
    }, getSponsoredRotationDelayMs(currentCampaign));
    return () => window.clearTimeout(timer);
  }, [activeCampaigns.length, currentCampaign, paused]);

  if (!currentCampaign?.product?._id || !currentCampaign.product.image) return null;

  const showCampaignAt = (index) => {
    setCurrentIndex(getNextSponsoredCampaignIndex(index, activeCampaigns.length));
  };
  const touchStartX = (event) => {
    event.currentTarget.dataset.touchStartX = String(event.touches[0]?.clientX ?? "");
  };
  const touchEnd = (event) => {
    const startX = Number(event.currentTarget.dataset.touchStartX);
    const endX = event.changedTouches[0]?.clientX;
    if (!Number.isFinite(startX) || typeof endX !== "number" || Math.abs(endX - startX) < 40) return;
    showCampaignAt(currentIndex + (endX < startX ? 1 : -1));
  };

  return (
    <article
      className="col-span-2 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:col-span-1"
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setPaused(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") setPaused(false);
      }}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onTouchStart={(event) => {
        setPaused(true);
        touchStartX(event);
      }}
      onTouchEnd={(event) => {
        touchEnd(event);
        setPaused(false);
      }}
      style={{ touchAction: "pan-y" }}
      aria-label={activeCampaigns.length > 1 ? `إعلانات ممولة، ${currentIndex + 1} من ${activeCampaigns.length}` : "إعلان ممول"}
    >
      <Link to={`/ad/${currentCampaign.product._id}`} className="block">
        <div className="relative">
          <img
            src={uploadsUrl(currentCampaign.product.image, "med")}
            alt={currentCampaign.product.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover"
          />
          <span className="absolute right-2 top-2 rounded-full bg-slate-950/75 px-2 py-0.5 text-[9px] font-black text-white">
            إعلان ممول
          </span>
        </div>
        <div className="p-2.5">
          <p className="line-clamp-2 text-xs font-black text-slate-900 dark:text-white sm:text-sm">{currentCampaign.product.title}</p>
          <p className="mt-0.5 text-[9px] font-bold text-slate-500">شاهد تفاصيل الإعلان</p>
        </div>
      </Link>
      {activeCampaigns.length > 1 && (
        <nav className="flex items-center justify-center gap-2 px-2 pb-2" aria-label="التنقل بين الإعلانات الممولة">
          <button
            type="button"
            onClick={() => showCampaignAt(currentIndex - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-base font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="الإعلان السابق"
          >
            ‹
          </button>
          <div className="flex items-center gap-1" role="group" aria-label="مؤشر الإعلانات">
            {activeCampaigns.map((campaign, index) => (
              <button
                key={campaign._id}
                type="button"
                onClick={() => showCampaignAt(index)}
                className="flex h-5 w-5 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`الإعلان ${index + 1} من ${activeCampaigns.length}`}
                aria-current={index === currentIndex ? "true" : undefined}
              >
                <span
                  aria-hidden="true"
                  className={`block rounded-full transition-colors ${
                    index === currentIndex
                      ? "h-2 w-2 bg-blue-600"
                      : "h-1.5 w-1.5 bg-slate-300 dark:bg-slate-600"
                  }`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => showCampaignAt(currentIndex + 1)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-base font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="الإعلان التالي"
          >
            ›
          </button>
        </nav>
      )}
    </article>
  );
}
