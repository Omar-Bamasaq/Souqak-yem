import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useChat } from "../store/ChatContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import {
  auctionStatusLabel,
  auctionDeliveryMethodLabel,
  auctionSaleStatusLabel,
  formatAuctionDate,
  formatAuctionMoney,
  getAuctionError,
  compareAuctionAmounts,
  stepAuctionBidAmount
} from "../utils/auctionFormat.js";

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export default function AuctionDetail() {
  const { id } = useParams();
  const api = useApi();
  const { user } = useAuth();
  const chatContext = useChat();
  const socket = chatContext?.socket;
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [error, setError] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [socketConnected, setSocketConnected] = useState(Boolean(socket?.connected));
  const requestRef = useRef(null);

  const loadAuction = useCallback(async () => {
    try {
      const response = await api.get(`/auctions/${id}`);
      const nextAuction = response.data.auction;
      setAuction(nextAuction);
      setAmount((current) => !current ||
        compareAuctionAmounts(current, nextAuction.minimumBidAmount) < 0
        ? nextAuction.minimumBidAmount
        : current);
      setBids(response.data.bids || []);
      setSelectedImage((current) =>
        Math.min(current, Math.max(0, (response.data.auction.images || []).length - 1))
      );
      setError("");
      setVerificationRequired(false);
    } catch (requestError) {
      setError(getAuctionError(requestError));
      setVerificationRequired(false);
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    setLoading(true);
    loadAuction();
  }, [loadAuction]);

  useEffect(() => {
    if (!socket) {
      setSocketConnected(false);
      return undefined;
    }
    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("join_auction", { auctionId: id });
    };
    const onDisconnect = () => setSocketConnected(false);
    const onAuctionUpdate = (payload) => {
      if (String(payload?.auctionId) === String(id)) loadAuction();
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("auction:updated", onAuctionUpdate);
    socket.on("auction:status", onAuctionUpdate);
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("auction:updated", onAuctionUpdate);
      socket.off("auction:status", onAuctionUpdate);
    };
  }, [socket, id, loadAuction]);

  useEffect(() => {
    if (socketConnected) return undefined;
    const interval = window.setInterval(loadAuction, 15_000);
    return () => window.clearInterval(interval);
  }, [socketConnected, loadAuction]);

  useEffect(() => {
    window.addEventListener("focus", loadAuction);
    return () => window.removeEventListener("focus", loadAuction);
  }, [loadAuction]);

  const submitBid = async (event) => {
    event.preventDefault();
    setError("");
    setVerificationRequired(false);
    setSubmitting(true);
    if (!requestRef.current || requestRef.current.amount !== amount) {
      requestRef.current = { amount, key: createIdempotencyKey() };
    }
    try {
      await api.post(`/auctions/${id}/bids`, {
        amount,
        idempotencyKey: requestRef.current.key
      });
      requestRef.current = null;
      setAmount("");
      await loadAuction();
    } catch (requestError) {
      setError(getAuctionError(requestError));
      setVerificationRequired(requestError.response?.data?.code === "AUCTION_VERIFICATION_REQUIRED");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p dir="rtl" className="py-12 text-center text-sm text-slate-500">جارٍ تحميل المزاد…</p>;
  }
  if (!auction) {
    return (
      <div dir="rtl" role="alert" className="rounded-2xl bg-white p-6 text-center dark:bg-slate-900">
        <p className="text-red-700">{error || "المزاد غير متاح."}</p>
        <Link to="/auctions" className="mt-4 inline-block font-bold text-blue-700">العودة إلى المزادات</Link>
      </div>
    );
  }

  const activeImage = auction.images?.[selectedImage];
  return (
    <section dir="rtl" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {activeImage ? (
            <img
              src={uploadsUrl(activeImage, "full")}
              alt={auction.title}
              className="max-h-[520px] min-h-64 w-full bg-slate-100 object-contain dark:bg-slate-800"
            />
          ) : (
            <div className="flex h-64 items-center justify-center bg-slate-100 dark:bg-slate-800">لا توجد صورة</div>
          )}
          {auction.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-t border-slate-100 p-3 dark:border-slate-800">
              {auction.images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  aria-label={`عرض الصورة ${index + 1}`}
                  className={`shrink-0 rounded-lg border-2 ${index === selectedImage ? "border-blue-600" : "border-transparent"}`}
                >
                  <img src={uploadsUrl(image, "thumb")} alt="" className="h-16 w-20 rounded-md object-cover" />
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="space-y-4 rounded-2xl bg-white p-5 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{auction.title}</h1>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {auctionStatusLabel(auction.status)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{auction.description}</p>
          <dl className="grid gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:grid-cols-2">
            <div><dt className="text-slate-500">السعر الحالي</dt><dd className="mt-1 font-black text-blue-700">{formatAuctionMoney(auction.currentPrice, auction.currency)}</dd></div>
            <div><dt className="text-slate-500">السعر الابتدائي</dt><dd className="mt-1 font-bold">{formatAuctionMoney(auction.startingPrice, auction.currency)}</dd></div>
            <div><dt className="text-slate-500">الحد الأدنى للزيادة</dt><dd className="mt-1 font-bold">{formatAuctionMoney(auction.minimumIncrement, auction.currency)}</dd></div>
            <div><dt className="text-slate-500">عدد العروض</dt><dd className="mt-1 font-bold">{auction.bidCount}</dd></div>
            <div><dt className="text-slate-500">بداية المزاد</dt><dd className="mt-1 font-bold">{formatAuctionDate(auction.startAt)}</dd></div>
            <div><dt className="text-slate-500">نهاية المزاد</dt><dd className="mt-1 font-bold">{formatAuctionDate(auction.endAt)}</dd></div>
            <div><dt className="text-slate-500">الفئة</dt><dd className="mt-1 font-bold">{auction.category?.name || "—"}</dd></div>
            <div><dt className="text-slate-500">الموقع</dt><dd className="mt-1 font-bold">{[auction.city?.name, auction.governorate?.name].filter(Boolean).join("، ") || "—"}</dd></div>
            <div><dt className="text-slate-500">حالة السلعة</dt><dd className="mt-1 whitespace-pre-wrap font-bold">{auction.itemCondition}</dd></div>
            <div><dt className="text-slate-500">العيوب والملاحظات</dt><dd className="mt-1 whitespace-pre-wrap font-bold">{auction.defectsNotes}</dd></div>
            <div><dt className="text-slate-500">طريقة التسليم والاستلام</dt><dd className="mt-1 font-bold">{auctionDeliveryMethodLabel(auction.deliveryMethod)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">تفاصيل التسليم والاستلام</dt><dd className="mt-1 whitespace-pre-wrap font-bold">{auction.deliveryDetails}</dd></div>
          </dl>
          {auction.seller && (
            <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              {auction.seller.avatar && <img src={uploadsUrl(auction.seller.avatar, "thumb")} alt="" className="h-10 w-10 rounded-full object-cover" />}
              <div>
                <p className="text-xs text-slate-500">البائع</p>
                <p className="font-bold">{auction.seller.name}</p>
              </div>
            </div>
          )}
          {auction.winner && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              {auction.winner.label}. قيمة العرض الفائز: {formatAuctionMoney(auction.winner.amount, auction.currency)}.
            </div>
          )}
          {auction.status === "ended" && auction.winner && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">{auctionSaleStatusLabel(auction.saleStatus)}</p>
          )}
        </article>

        <section className="rounded-2xl bg-white p-5 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-black">سجل العروض</h2>
          {bids.length ? (
            <ol className="divide-y divide-slate-100 dark:divide-slate-800">
              {bids.map((bid) => (
                <li key={bid.sequence} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{bid.bidderLabel}</span>
                  <span className="font-bold">{formatAuctionMoney(bid.amount, auction.currency)}</span>
                  <time className="text-xs text-slate-500">{formatAuctionDate(bid.createdAt)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">لا توجد عروض حتى الآن.</p>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="sticky top-20 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <p className="text-sm text-slate-500">السعر الحالي</p>
            <p className="mt-1 text-xl font-black text-blue-700">{formatAuctionMoney(auction.currentPrice, auction.currency)}</p>
          </div>
          {auction.status === "live" && user ? (
            <form onSubmit={submitBid} className="space-y-3">
              <div>
                <p className="text-sm font-bold">قيمة عرضك</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="إنقاص قيمة المزايدة"
                    title="إنقاص بمقدار الحد الأدنى للزيادة"
                    disabled={submitting || compareAuctionAmounts(amount || auction.minimumBidAmount, auction.minimumBidAmount) <= 0}
                    onClick={() => setAmount((current) => stepAuctionBidAmount(
                      current,
                      auction.minimumIncrement,
                      auction.minimumBidAmount,
                      -1
                    ))}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-2xl font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
                  >
                    −
                  </button>
                  <output aria-live="polite" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 px-3 text-center font-black text-blue-700 dark:border-slate-600 dark:text-blue-300">
                    {formatAuctionMoney(amount || auction.minimumBidAmount, auction.currency)}
                  </output>
                  <button
                    type="button"
                    aria-label="زيادة قيمة المزايدة"
                    title={`زيادة بمقدار ${formatAuctionMoney(auction.minimumIncrement, auction.currency)}`}
                    disabled={submitting}
                    onClick={() => setAmount((current) => stepAuctionBidAmount(
                      current || auction.minimumBidAmount,
                      auction.minimumIncrement,
                      auction.minimumBidAmount,
                      1
                    ))}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-2xl font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  الحد الأدنى {formatAuctionMoney(auction.minimumBidAmount, auction.currency)} · كل سهم يغيّر العرض بمقدار {formatAuctionMoney(auction.minimumIncrement, auction.currency)}
                </p>
              </div>
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">
                {submitting ? "جارٍ إرسال العرض…" : "زايد"}
              </button>
            </form>
          ) : auction.status === "live" ? (
            <Link to="/login" className="block rounded-xl bg-blue-700 px-4 py-3 text-center font-bold text-white">سجل الدخول للمزايدة</Link>
          ) : auction.status === "scheduled" ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">يبدأ المزاد في {formatAuctionDate(auction.startAt)}.</p>
          ) : auction.status === "ended" ? (
            <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">انتهى وقت المزايدة.</p>
          ) : null}
          <Link to="/auctions" className="block text-center text-sm font-bold text-blue-700">العودة إلى المزادات</Link>
        </section>
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>{error}</p>
            {verificationRequired && (
              <Link to="/seller/verification" className="mt-2 inline-flex font-black text-blue-800 underline underline-offset-2 hover:text-blue-900">
                انتقل إلى صفحة توثيق الحساب
              </Link>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}
