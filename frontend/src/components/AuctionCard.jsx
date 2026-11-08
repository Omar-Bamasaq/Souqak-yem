import React from "react";
import { Link } from "react-router-dom";
import { uploadsUrl } from "../lib/uploads.js";
import {
  auctionStatusLabel,
  formatAuctionDate,
  formatAuctionMoney
} from "../utils/auctionFormat.js";

export default function AuctionCard({ auction, ownerView = false }) {
  const image = auction.images?.[0];
  const destination =
    ownerView && ["draft", "rejected"].includes(auction.status)
      ? `/auctions/new?id=${auction.id}`
      : `/auctions/${auction.id}`;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <Link to={destination} className="block">
        {image ? (
          <img
            src={uploadsUrl(image, "thumb")}
            alt={auction.title}
            loading="lazy"
            className="h-44 w-full bg-slate-100 object-cover dark:bg-slate-800"
          />
        ) : (
          <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            لا توجد صورة
          </div>
        )}
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={destination}
            className="line-clamp-2 font-bold text-slate-900 hover:text-blue-700 dark:text-white"
          >
            {auction.title}
          </Link>
          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
            {auctionStatusLabel(ownerView ? auction.reviewStatus === "pending" ? "pending" : auction.status : auction.status)}
          </span>
        </div>
        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <p>
            السعر الحالي:{" "}
            <strong className="text-slate-900 dark:text-white">
              {formatAuctionMoney(auction.currentPrice, auction.currency)}
            </strong>
          </p>
          <p>العروض: {auction.bidCount ?? 0}</p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>{auction.governorate?.name || "اليمن"}</span>
          <span>{formatAuctionDate(auction.endAt)}</span>
        </div>
      </div>
    </article>
  );
}
