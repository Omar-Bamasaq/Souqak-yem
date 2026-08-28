import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { useChat } from "../store/ChatContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";

export default function Chat() {
  const { productId } = useParams();
  const api = useApi();
  const { user } = useAuth();
  const { join } = useChat();
  const [chat, setChat] = useState(null);
  const [ad, setAd] = useState(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);

  const load = async () => {
    setErr("");
    try {
      const [chatRes, adRes] = await Promise.all([
        api.get(`/chats/${productId}`),
        api.get(`/ads/${productId}`)
      ]);
      setChat(chatRes.data);
      setAd(adRes.data);
      join(productId);
    } catch {
      setErr("لا يمكنك الوصول إلى هذه المحادثة");
    }
  };

  const completeDeal = async () => {
    if (!finalPrice || !chat || !ad) return;
    try {
      setSubmitting(true);
      const buyerId = chat?.participants?.find(p => String(p) !== String(me));
      
      if (!buyerId) throw new Error("لم يتم العثور على المشتري في هذه المحادثة");
      
      if (ad?.isResell) {
        await api.post("/resell/mark-as-sold", {
          resellAdId: ad._id,
          buyerId,
          chatId: productId,
          finalPriceOverride: Number(finalPrice)
        });
      } else {
        await api.patch(`/conversations/${productId}/close`, {
          finalPrice: Number(finalPrice),
          finalCurrency: ad.currency || "YER_ADEN"
        });
      }
      
      setDealModalOpen(false);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تسجيل الصفقة بنجاح بانتظار التأكيد", type: "success" } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: err.response?.data?.error || "حدث خطأ", type: "error" } }));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    load();
  }, [productId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat?.messages?.length]);

  const send = async () => {
    if (!text.trim()) return;
    const me = user?.id || user?._id;
    const message = { sender: me, text, createdAt: new Date().toISOString() };
    setChat((c) => ({ ...c, messages: [...(c?.messages || []), message] }));
    setText("");
    await api.post(`/chats/${productId}`, { text });
  };

  const me = user?.id || user?._id;
  const isReseller = ad?.isResell && String(ad?.resellerId?._id || ad?.resellerId) === String(me);
  const isOriginalSeller = ad && !ad.isResell && String(ad?.userId?._id || ad?.userId) === String(me);
  const canMarkSold = isReseller || isOriginalSeller;

  return (
    <div className="mx-auto max-w-3xl ds-section p-0">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">المحادثة</h2>
        {canMarkSold && ad?.status === 'active' && (
          <button 
            onClick={() => setDealModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-md active:scale-95"
          >
            إتمام الصفقة 🤝
          </button>
        )}
      </div>
      <div ref={listRef} className="max-h-[60vh] overflow-y-auto px-4 py-4">
        {(chat?.messages || []).map((m, idx) => {
          const isMe = String(m.sender) === String(me);
          return (
            <div key={idx} className={`mb-3 flex ${isMe ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-brand-50 text-gray-900" : "bg-gray-100 text-gray-900"}`}>
                <div>{m.text}</div>
                <div className="mt-1 text-[11px] text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t p-3">
        <input className="ds-input flex-1" placeholder="اكتب رسالتك..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="ds-btn-primary" onClick={send}>إرسال</button>
      </div>

      {/* Deal Modal */}
      {dealModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDealModalOpen(false)}>
          <div className="w-full max-w-sm rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-gray-900 mb-4">إتمام الصفقة</h3>
            <p className="text-xs text-gray-500 mb-6">يرجى تحديد السعر النهائي الذي اتفقت عليه مع المشتري. سيتم إرسال طلب تأكيد للبائع الأصلي لتسجيل أرباحك.</p>
            
            <div className="mb-6">
              <label className="mb-2 block text-[10px] font-black text-gray-400 uppercase px-1">السعر النهائي (ر.ي)</label>
              <input
                type="number"
                className="ds-input w-full bg-gray-50 border-gray-100 font-medium py-3"
                placeholder="أدخل المبلغ المتفق عليه..."
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={completeDeal}
                disabled={submitting}
                className="flex-[2] h-12 rounded-2xl bg-green-600 text-white font-black hover:bg-green-700 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-green-100"
              >
                {submitting ? "جارٍ الإرسال..." : "تأكيد وإرسال"}
              </button>
              <button onClick={() => setDealModalOpen(false)} className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
