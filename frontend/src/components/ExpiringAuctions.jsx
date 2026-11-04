import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import { formatAuctionMoney, getAuctionError, unpackList } from "../utils/auctionFormat.js";
import { formatAuctionCountdown, getExpiringAuctions } from "../lib/expiringAuctions.js";

function ExpiringAuctionCard({ auction, now }) {
  const remaining = new Date(auction.endAt).getTime() - now;
  const image = auction.images?.[0];

  return (
    <Link
      to={`/auctions/${auction.id}`}
      className="group flex min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-red-950/10 transition hover:-translate-y-1 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {image ? (
        <img src={uploadsUrl(image, "thumb")} alt="" loading="lazy" className="h-28 w-24 shrink-0 object-cover sm:h-32 sm:w-28" />
      ) : (
        <div className="flex h-28 w-24 shrink-0 items-center justify-center bg-white/10 text-3xl sm:h-32 sm:w-28" aria-hidden="true">🔨</div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 sm:p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-black text-white sm:text-base">{auction.title}</h3>
          <p className="mt-1 text-xs font-bold text-amber-100">{formatAuctionMoney(auction.currentPrice, auction.currency)}</p>
        </div>
        <div className="rounded-xl bg-slate-950/25 px-2.5 py-1.5">
          <p className="text-[10px] font-bold text-red-100">ينتهي خلال</p>
          <p role="timer" aria-label={`الوقت المتبقي ${formatAuctionCountdown(auction.endAt, now)}`} className="font-mono text-lg font-black tracking-wider text-white" dir="ltr">
            {formatAuctionCountdown(auction.endAt, now)}
          </p>
        </div>
      </div>
      <span className="flex items-center px-2 text-white/80 transition-transform group-hover:-translate-x-1" aria-hidden="true">←</span>
    </Link>
  );
}

export default function ExpiringAuctions() {
  const api = useApi();
  const [auctions, setAuctions] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get("/auctions", {
          params: { status: "live", sort: "endingSoon", page: 1, pageSize: 50 }
        });
        if (active) {
          setAuctions(unpackList(data));
          setError("");
        }
      } catch (requestError) {
        if (active) {
          console.error("Expiring auctions load failed:", requestError);
          setError(getAuctionError(requestError));
        }
      }
    };

    load();
    const refreshInterval = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, [api]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const expiringAuctions = useMemo(() => getExpiringAuctions(auctions, now).slice(0, 4), [auctions, now]);
  if (!expiringAuctions.length) {
    return error ? <p role="status" className="mb-6 rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{error}</p> : null;
  }

  return (
    <section aria-labelledby="expiring-auctions-heading" className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-l from-rose-700 via-red-600 to-orange-500 p-4 text-white shadow-xl shadow-red-200/50 dark:shadow-none sm:mb-10 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl" aria-hidden="true">⏳</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-100">فرصتك قبل انتهاء المزاد</p>
              <h2 id="expiring-auctions-heading" className="text-lg font-black sm:text-2xl">مزادات تنتهي خلال 24 ساعة</h2>
            </div>
          </div>
          <Link to="/auctions" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-red-700 transition hover:bg-amber-50 sm:px-4 sm:text-sm">
            تصفح كل المزادات ←
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {expiringAuctions.map((auction) => <ExpiringAuctionCard key={auction.id} auction={auction} now={now} />)}
        </div>
      </div>
    </section>
  );
}
