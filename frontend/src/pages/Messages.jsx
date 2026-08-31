import React, { useEffect, useRef, useState } from "react";
// Re-compilation trigger
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useChat } from "../store/ChatContext.jsx";
import MobileSelect from "../components/MobileSelect.jsx";
import { uploadsUrl } from "../lib/uploads.js";

const QUICK_REPLIES = {
  seller: [
    { category: "التوفر", label: "متوفر", text: "متوفر" },
    { category: "التوفر", label: "نعم متوفر", text: "نعم متوفر" },
    { category: "السعر", label: "السعر", text: (ad) => "السعر: " + (ad?.price || "") + " " + (ad?.currency === 'YER_ADEN' ? 'ريال يمني (عدن)' : ad?.currency === 'YER_SANAA' ? 'ريال يمني (صنعاء)' : ad?.currency === 'SAR' ? 'ريال سعودي' : ad?.currency === 'USD' ? 'دولار أمريكي' : ad?.currency || "ريال") },
    { category: "السعر", label: "السعر نهائي", text: "السعر نهائي" },
    { category: "السعر", label: "السعر قابل للتفاوض", text: "السعر قابل للتفاوض" },
    { category: "الموقع", label: "الموقع", text: (ad) => "الموقع: " + (ad?.governorateId?.name || "") + " " + (ad?.cityId?.name || "") },
    { category: "الاتفاق", label: "تواصل على الرقم", text: (ad) => "تواصل على الرقم: " + (ad?.contactInfo?.phone || "") },
    { category: "الاتفاق", label: "متى يناسبك؟", text: "متى يناسبك؟" },
    { category: "الاتفاق", label: "تم البيع", text: "تم البيع" },
  ],
  buyer: [
    { category: "التوفر", label: "هل ما زال متوفر؟", text: "هل ما زال متوفر؟" },
    { category: "السعر", label: "كم السعر النهائي؟", text: "كم السعر النهائي؟" },
    { category: "السعر", label: "هل فيه تفاوض؟", text: "هل فيه تفاوض؟" },
    { category: "الموقع", label: "فين موقعك؟", text: "فين موقعك؟" },
    { category: "التوفر", label: "هل فيه عيوب؟", text: "هل فيه عيوب؟" },
    { category: "الاتفاق", label: "ممكن أشوفه اليوم؟", text: "ممكن أشوفه اليوم؟" },
    { category: "الاتفاق", label: "متى نلتقي؟", text: "متى نلتقي؟" },
  ]
};

const REPORT_CONFIG = {
  ad: {
    categories: [
      { id: "content", label: "محتوى الإعلان", reasons: ["لغة غير لائقة", "قسم خاطئ", "إعلان مكرر"] },
      { id: "violations", label: "مخالفات", reasons: ["سلعة ممنوعة", "محتوى غير قانوني"] },
      { id: "fraud", label: "احتيال", reasons: ["إعلان وهمي", "سعر مضلل"] },
      { id: "images", label: "الصور", reasons: ["جودة رديئة", "صور غير متعلقة بالسلعة", "صور مخلة"] }
    ]
  },
  user: {
    categories: [
      { id: "treatment", label: "سوء تعامل", reasons: ["إهانات", "قلة أدب"] },
      { id: "fraud", label: "احتيال", reasons: ["نصب", "حساب وهمي"] },
      { id: "violations", label: "مخالفات", reasons: ["مخالفة سياسة المنصة"] },
      { id: "behavior", label: "سلوك غير مرغوب", reasons: ["سبام (إزعاج)", "تحرش"] }
    ]
  }
};

export default function Messages() {
  const navigate = useNavigate();
  const api = useApi();
  const { user } = useAuth();
  const { socket } = useChat() || {};
  const [conversations, setConversations] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [selectedConv, setSelectedConv] = useState(null);
  const [selectedAdminMsg, setSelectedAdminMsg] = useState(null);
  const [direct, setDirect] = useState(false);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isCounterTyping, setIsCounterTyping] = useState(false);
  const typingTimer = useRef(null);
  const [files, setFiles] = useState([]);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbSrc, setLbSrc] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState("user"); // "user" or "ad"
  const [reportCategory, setReportCategory] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showCommissionMsg, setShowCommissionMsg] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAllQuickReplies, setShowAllQuickReplies] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [finalCurrency, setFinalCurrency] = useState("YER_ADEN");
  const [isClosing, setIsClosing] = useState(false);
  
  // Context Menu State
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, targetId: null, type: null }); // type: 'conversation' or 'message'
  const longPressTimer = useRef(null);

  const showConvsSpinner = loading && conversations.length === 0;
  const showMsgsSpinner = msgsLoading && msgs.length === 0;

  const handleSold = async (price) => {
     if (!selectedConv?.adId?._id) return;
     // If price is an event (called from onClick={handleSold}), use ad price or prompt
     let actualPrice = typeof price === 'number' ? price : Number(selectedConv?.adId?.price) || 0;
     
     try {
       await api.patch(`/ads/${selectedConv.adId._id}/close`, { reason: "sold", price: actualPrice });
       setShowCommissionMsg(true);
       loadConvs();
     } catch (err) {
       window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تعذر تحديث الحالة", type: "error" } }));
       throw err;
     }
   };

  const onConfirmSale = async () => {
     if (!selectedId) {
       console.error("No selectedId found");
       return;
     }
     setIsClosing(true);
     try {
       const priceValue = Number(finalPrice) || 0;
       await api.patch(`/conversations/${selectedId}/close`, { 
         finalPrice: priceValue,
         finalCurrency: finalCurrency
       });
       setShowSoldModal(false);
       setShowCommissionMsg(true);
       loadConvs();
       window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم إتمام البيع بنجاح", type: "success" } }));
     } catch (err) {
       console.error("Close conversation error:", err);
       const errMsg = err.response?.data?.error || "فشل إتمام العملية";
       window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: errMsg, type: "error" } }));
     } finally {
       setIsClosing(false);
     }
   };

  const handleStillAvailable = async () => {
    if (!selectedConv?.adId?._id) return;
    try {
      await api.patch(`/ads/${selectedConv.adId._id}/keep-active`);
      loadConvs();
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تعذر تحديث الحالة", type: "error" } }));
    }
  };

  const isSeller = selectedConv && String(selectedConv.adId?.userId?._id || selectedConv.adId?.userId) === String(user?.id || user?._id);
  const replies = isSeller ? QUICK_REPLIES.seller : QUICK_REPLIES.buyer;

  const handleQuickReply = async (reply, sendDirectly = false) => {
    const textToInsert = typeof reply.text === 'function' ? reply.text(selectedConv?.adId) : reply.text;
    if (sendDirectly) {
      try {
        const res = await api.post(`/conversations/${selectedId}/messages`, { text: textToInsert });
        setMsgs((m) => {
          if (m.find(msg => String(msg._id) === String(res.data._id))) return m;
          return [...m, res.data];
        });
        setText("");
        loadConvs();
      } catch {}
    } else {
      setText(textToInsert);
    }
  };

  const groupedReplies = replies.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  const isAdActive = selectedConv?.adId?.status === "approved" && !selectedConv?.adId?.sold;
   
   const getReminderThreshold = (count) => {
     if (count === 0) return 3 * 24 * 60 * 60 * 1000;
     if (count === 1) return 7 * 24 * 60 * 60 * 1000;
     if (count === 2) return 14 * 24 * 60 * 60 * 1000;
     return Infinity;
   };

   const showSoldReminder = 
     isSeller &&
     isAdActive &&
     selectedConv.updatedAt &&
     msgs.length > 0 &&
     (selectedConv.adId?.soldReminderCount || 0) < 3 &&
     (new Date() - new Date(selectedConv.updatedAt)) > getReminderThreshold(selectedConv.adId?.soldReminderCount || 0);

   const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true });
    if (isToday) return timeStr;
    if (isYesterday) return `أمس ${timeStr}`;
    return `${d.toLocaleDateString("ar-EG")} ${timeStr}`;
  };

  const loadConvs = async () => {
    setLoading(true);
    try {
      const [convsRes, adminRes] = await Promise.all([
        api.get("/conversations"),
        api.get("/admin-messages/my-messages")
      ]);
      
      // Deduplicate conversations by _id
      const uniqueConvs = (convsRes.data || []).reduce((acc, curr) => {
        if (!acc.find(item => item._id === curr._id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      const uniqueAdminMsgs = (adminRes.data || []).reduce((acc, curr) => {
        if (!acc.find(item => item._id === curr._id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      setConversations(uniqueConvs);
      setAdminMessages(uniqueAdminMsgs);
    } catch {
      setConversations([]);
      setAdminMessages([]);
    } finally {
      setLoading(false);
  }
};
  const loadMsgs = async (id) => {
    try {
      setMsgsLoading(true);
      const res = await api.get(`/conversations/${id}/messages`);
      const messages = res.data || [];
      // Deduplicate messages by _id
      const uniqueMsgs = messages.reduce((acc, curr) => {
        if (!acc.find(item => String(item._id) === String(curr._id))) {
          acc.push(curr);
        }
        return acc;
      }, []);
      setMsgs(uniqueMsgs);
    } catch {
      setMsgs([]);
    } finally { setMsgsLoading(false); }
  };

  useEffect(() => {
    loadConvs();
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("c") || "";
    const d = sp.get("direct") || "";
    if (d === "1") setDirect(true);
    if (c) {
      setSelectedId(c);
      loadMsgs(c);
    }
  }, []);
  useEffect(() => {
    (async () => {
      // Priority: Admin Message
      if (selectedAdminId) {
        // Clear regular selection to avoid conflict
        if (selectedId) setSelectedId("");
        
        const msg = adminMessages.find(m => m._id === selectedAdminId);
        setSelectedAdminMsg(msg);
        if (msg && !msg.isRead) {
          try {
            await api.post(`/admin-messages/${selectedAdminId}/read`);
            setAdminMessages(prev => prev.map(m => m._id === selectedAdminId ? { ...m, isRead: true } : m));
          } catch (err) {
            console.error(err);
          }
        }
        return;
      }
      
      // Regular Conversation
      if (selectedId) {
        // Clear admin selection to avoid conflict
        if (selectedAdminId) setSelectedAdminId("");
        if (selectedAdminMsg) setSelectedAdminMsg(null);

        try {
          await api.patch(`/conversations/${selectedId}/read`);
          // Dispatch read event to update unread counts across the app
          window.dispatchEvent(new CustomEvent("conversation:read", { detail: { conversationId: selectedId } }));
        } catch {}
        await loadMsgs(selectedId);
        await loadConvs();
        
        // Fetch the single conversation directly to ensure we have the latest data
        try {
          const convRes = await api.get(`/conversations/${selectedId}`);
          setSelectedConv(convRes.data);
          setMuted(!!convRes.data.muted);
          
          // Also check if the counterpart is blocked
          if (convRes.data.counterpartId) {
            const blocks = (await api.get("/blocks")).data || [];
            const exists = blocks.find((b) => String(b.blockedId?._id || b.blockedId) === String(convRes.data.counterpartId));
            setBlocked(!!exists);
          }
        } catch (err) {
          console.error("Failed to fetch conversation:", err);
          // Fallback to the list if direct fetch fails
          setSelectedConv((prev) => {
            const updated = (conversations || []).find((x) => x._id === selectedId);
            return updated || prev;
          });
        }
        
        try {
          window.dispatchEvent(new CustomEvent("conversation:active", { detail: { conversationId: selectedId } }));
        } catch {}
      }
    })();
  }, [selectedId, selectedAdminId]);

  const send = async () => {
    if (!selectedId) return;
    if (!text.trim() && files.length === 0) return;
    try {
      let res;
      if (files.length > 0) {
        const form = new FormData();
        if (text.trim()) form.append("text", text.trim());
        files.forEach((f) => form.append("images", f));
        res = await api.post(`/conversations/${selectedId}/messages`, form, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        res = await api.post(`/conversations/${selectedId}/messages`, { text });
      }
      setMsgs((m) => {
        if (m.find(msg => String(msg._id) === String(res.data._id))) return m;
        return [...m, res.data];
      });
      setText("");
      setFiles([]);
      loadConvs();
    } catch {}
  };

  useEffect(() => {
    if (!socket) return;
    const onNew = (e) => {
      const { conversationId, message } = e.detail || {};
      if (conversationId !== selectedId) return;
      setMsgs((arr) => {
        // Prevent duplicate messages by ID
        if (arr.find(m => String(m._id) === String(message._id))) return arr;
        return [...arr, message];
      });
    };
    const onTyping = (e) => {
      const { conversationId } = e.detail || {};
      if (conversationId !== selectedId) return;
      setIsCounterTyping(true);
      setTimeout(() => setIsCounterTyping(false), 1500);
    };
    const onRead = (e) => {
      const { conversationId } = e.detail || {};
      if (conversationId !== selectedId) return;
      setMsgs((arr) => arr.map((m) => (m.status === "read" ? m : { ...m, status: "read" })));
    };
    const onStatusUpdate = (e) => {
      const { messageId, status, conversationId } = e.detail || {};
      if (conversationId !== selectedId) return;
      setMsgs((arr) => arr.map((m) => (String(m._id) === String(messageId) ? { ...m, status } : m)));
    };
    const onUserStatus = (e) => {
      const { userId, isOnline, lastSeen } = e.detail || {};
      setConversations((prev) => 
        prev.map((c) => 
          String(c.counterpartId) === String(userId) 
            ? { ...c, counterpartIsOnline: isOnline, counterpartLastSeen: lastSeen } 
            : c
        )
      );
    };
    window.addEventListener("conversation:new_message", onNew);
    window.addEventListener("conversation:typing", onTyping);
    window.addEventListener("conversation:read", onRead);
    window.addEventListener("message:status_update", onStatusUpdate);
    window.addEventListener("user:status", onUserStatus);
    return () => {
      window.removeEventListener("conversation:new_message", onNew);
      window.removeEventListener("conversation:typing", onTyping);
      window.removeEventListener("conversation:read", onRead);
      window.removeEventListener("message:status_update", onStatusUpdate);
      window.removeEventListener("user:status", onUserStatus);
    };
  }, [socket, selectedId]);

  const getAdInfo = (conv) => {
    if (!conv || !conv.adId) return { title: "محادثة", image: null, id: null, status: null, sold: false };
    const isResell = conv.adModel === "ResellAd";
    const ad = isResell ? conv.adId.originalAdId : conv.adId;
    return {
      title: ad?.title || "محادثة",
      image: ad?.images?.[0] || null,
      id: isResell ? conv.adId._id : (ad?._id || conv.adId),
      originalId: isResell ? ad?._id : (ad?._id || conv.adId),
      status: isResell ? conv.adId.status : ad?.status,
      sold: isResell ? (conv.adId.status === "sold" || ad?.sold) : ad?.sold,
      newPrice: isResell ? conv.adId.newPrice : null,
      price: isResell ? conv.adId.newPrice : ad?.price,
      currency: ad?.currency
    };
  };

  useEffect(() => {
    if (!socket || !selectedId) return;
    socket.emit("join_conversation", { conversationId: selectedId });
  }, [socket, selectedId]);
  const onType = (e) => {
    setText(e.target.value);
    setTyping(true);
    if (socket && selectedId) socket.emit("conversation:typing", { conversationId: selectedId, from: user?.id || user?._id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1200);
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const am = sp.get("am");
    if (am) {
      setSelectedAdminId(am);
    }
  }, [adminMessages]);

  useEffect(() => {
    if (!selectedId) return;
    const found = (conversations || []).find((x) => x._id === selectedId);
    setSelectedConv(found || null);
  }, [conversations, selectedId]);

  const clearSelection = () => {
    setSelectedId("");
    setSelectedAdminId("");
    setSelectedConv(null);
    setSelectedAdminMsg(null);
    setMsgs([]);
    // Remove query params from URL without refreshing
    const url = new URL(window.location);
    url.searchParams.delete("c");
    url.searchParams.delete("am");
    window.history.replaceState({}, "", url);
  };

  // --- Context Menu Handlers ---
  const handleContextMenu = (e, targetId, type) => {
    e.preventDefault();
    setMenu({
      visible: true,
      x: e.pageX,
      y: e.y || e.pageY,
      targetId,
      type
    });
  };

  const handleTouchStart = (e, targetId, type) => {
    const { pageX, pageY } = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setMenu({
        visible: true,
        x: pageX,
        y: pageY,
        targetId,
        type
      });
    }, 600); // 600ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const closeMenu = () => setMenu({ ...menu, visible: false });

  useEffect(() => {
    const handleClick = () => closeMenu();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const onPin = async () => {
    if (menu.type !== 'conversation') return;
    try {
      await api.patch(`/conversations/${menu.targetId}/pin`);
      loadConvs();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم تثبيت المحادثة", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل التثبيت", type: "error" } }));
    }
    closeMenu();
  };

  const onMute = async () => {
    if (!selectedId) return;
    try {
      await api.patch(`/conversations/${selectedId}/${muted ? "unmute" : "mute"}`);
      setMuted(!muted);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: muted ? "تم إلغاء الكتم" : "تم كتم المحادثة", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل تنفيذ الطلب", type: "error" } }));
    }
    setShowChatMenu(false);
  };

  const onBlock = async () => {
    if (!selectedConv?.counterpartId) return;
    const counterpartId = selectedConv.counterpartId?._id || selectedConv.counterpartId;
    if (!blocked && !window.confirm("هل أنت متأكد من حظر هذا المستخدم؟ لن تتمكن من مراسلته مرة أخرى.")) return;
    try {
      if (blocked) {
        await api.delete(`/blocks/${counterpartId}`);
        setBlocked(false);
        window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم إلغاء الحظر", type: "success" } }));
      } else {
        await api.post("/blocks", { blockedId: counterpartId });
        setBlocked(true);
        window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم حظر المستخدم", type: "success" } }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل تنفيذ الطلب", type: "error" } }));
    }
    setShowChatMenu(false);
  };

  const onUnpin = async () => {
    if (menu.type !== 'conversation') return;
    try {
      await api.patch(`/conversations/${menu.targetId}/unpin`);
      loadConvs();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم إلغاء التثبيت", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل إلغاء التثبيت", type: "error" } }));
    }
    closeMenu();
  };

  const onDeleteConv = async () => {
    if (menu.type !== 'conversation') return;
    if (!window.confirm("هل أنت متأكد من حذف هذه المحادثة؟")) return;
    try {
      await api.delete(`/conversations/${menu.targetId}`);
      if (selectedId === menu.targetId) clearSelection();
      loadConvs();
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم حذف المحادثة", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل الحذف", type: "error" } }));
    }
    closeMenu();
  };

  const onDeleteMsg = async () => {
    if (menu.type !== 'message') return;
    if (!window.confirm("هل أنت متأكد من حذف هذه الرسالة؟")) return;
    try {
      await api.delete(`/conversations/${selectedId}/messages/${menu.targetId}`);
      setMsgs(prev => prev.filter(m => m._id !== menu.targetId));
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم حذف الرسالة", type: "success" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل الحذف", type: "error" } }));
    }
    closeMenu();
  };

  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            rel="noopener noreferrer"
            className={`${text.includes('📍 موقعي الحالي') ? 'underline font-black text-blue-100 hover:text-white' : 'text-blue-600 underline hover:text-blue-800'} break-all`}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className={`grid grid-cols-1 gap-0 ${direct ? "" : "md:grid-cols-12"} h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] overflow-hidden bg-white relative`}>
      {!direct && (
      <div className={`md:col-span-4 lg:col-span-3 flex flex-col overflow-hidden border-l border-gray-100 ${selectedId || selectedAdminId ? "hidden md:flex" : "flex"}`}>
        <div className="border-b px-4 py-4 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-base font-bold text-gray-800">المحادثات</h3>
          {(adminMessages.length > 0 || conversations.length > 0) && (
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-bold">
              {adminMessages.length + conversations.length}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {showConvsSpinner && <div className="flex items-center justify-center p-6"><LoadingSpinner /></div>}
          {!showConvsSpinner && adminMessages.length === 0 && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 font-medium">لا توجد محادثات حتى الآن</p>
            </div>
          )}
          {!showConvsSpinner && (adminMessages.length > 0 || conversations.length > 0) && (
            <div className="divide-y divide-gray-100">
              {/* Admin Messages - Pinned at top */}
              {adminMessages.map((m) => (
                <button
                  key={`admin-${m._id}`}
                  className={`flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-amber-50/80 ${selectedAdminId === m._id ? "bg-amber-50 border-r-4 border-amber-500" : "bg-amber-50/30"}`}
                  onClick={() => {
                    setSelectedAdminId(m._id);
                    setSelectedId(""); // Clear regular conversation
                    setSelectedConv(null);
                    setMsgs([]);
                  }}
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
                    <img src="/assets/logo/app-icon.svg" alt="سوقك" className="h-full w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="text-sm font-bold text-amber-900 truncate">إدارة المنصة</div>
                      {!m.isRead && <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse"></span>}
                    </div>
                    <div className="text-[11px] font-bold text-amber-800 line-clamp-1 mb-0.5">{m.title}</div>
                    <div className="text-[11px] text-amber-700/80 line-clamp-1">{m.content}</div>
                  </div>
                </button>
              ))}
              
              {/* Regular Conversations */}
              {conversations.map((c) => (
                <button
                  key={`conv-${c._id}`}
                  className={`flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-gray-50 relative ${selectedId === c._id ? "bg-gray-50 border-r-4 border-brand-500" : ""}`}
                  onClick={() => {
                    setSelectedId(c._id);
                    setSelectedAdminId(""); // Clear admin message
                    setSelectedAdminMsg(null);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, c._id, 'conversation')}
                  onTouchStart={(e) => handleTouchStart(e, c._id, 'conversation')}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="relative h-12 w-12 flex-shrink-0">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100 border border-gray-200 shadow-sm">
                      {c.counterpartAvatar ? (
                        <img 
                          src={uploadsUrl(c.counterpartAvatar, "thumb")} 
                          alt="" 
                          className="h-full w-full object-cover" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = uploadsUrl(c.counterpartAvatar, "full");
                          }}
                        />
                      ) : getAdInfo(c).image ? (
                        <img 
                          src={uploadsUrl(getAdInfo(c).image, "thumb")} 
                          alt="" 
                          className="h-full w-full object-cover" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = uploadsUrl(getAdInfo(c).image, "full");
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm font-bold text-gray-500">
                          {(c.counterpartName || "?").slice(0, 1)}
                        </div>
                      )}
                    </div>
                    {c.counterpartIsOnline && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 shadow-sm"></span>
                    )}
                    {c.isPinned && (
                      <div className="absolute -top-1 -left-1 bg-brand-500 text-white p-0.5 rounded-full border-2 border-white shadow-sm">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="truncate text-sm font-bold text-gray-900 flex items-center gap-1">
                        {getAdInfo(c).title}
                      </div>
                      <div className="whitespace-nowrap text-[10px] text-gray-500">{formatTime(c.updatedAt)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[11px] text-gray-600">
                        <span className="font-semibold text-gray-800">{c.counterpartName || "مستخدم"}</span>: {c.lastMessage || "بدأ المحادثة"}
                      </div>
                      {Number(c.unreadCount || 0) > 0 && (
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white shadow-sm">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
      
      <div className={`${direct ? "" : "md:col-span-8 lg:col-span-9"} flex flex-col overflow-hidden ${selectedId || selectedAdminId ? "flex" : "hidden md:flex"} relative bg-gray-50/30`}>
        {!selectedId && !selectedAdminId && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
              <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">رسائلك</h3>
            <p className="text-sm text-gray-500 max-w-xs">اختر محادثة من القائمة الجانبية للبدء في المراسلة</p>
          </div>
        )}
        
        {/* Admin Message Content View */}
        {selectedAdminId && selectedAdminMsg && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-amber-100 shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={clearSelection}
                  className="md:hidden p-2 -mr-2 rounded-full hover:bg-amber-50 text-amber-700 transition-colors"
                  title="رجوع للقائمة"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="h-10 w-10 flex items-center justify-center">
                  <img src="/assets/logo/app-icon.svg" alt="سوقك" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-amber-900">إدارة المنصة</div>
                  <div className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    رسالة رسمية
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                  System Notification
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-amber-50/10">
              <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 flex flex-col items-center text-center mb-4">
                  <img src="/assets/logo/app-icon.svg" alt="سوقك" className="h-20 w-20 object-contain" />
                </div>
                <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                  <h2 className="mb-6 text-xl sm:text-2xl font-black text-amber-900 border-b border-amber-50 pb-4 leading-tight text-center">{selectedAdminMsg.title}</h2>
                  <div className="whitespace-pre-wrap text-base sm:text-lg leading-relaxed text-gray-800 font-medium">
                    {selectedAdminMsg.content}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Regular Conversation Content View */}
        {selectedId && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between bg-white border-b shadow-sm z-20">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button 
                  onClick={clearSelection}
                  className="md:hidden p-2 -mr-1 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                  title="رجوع للقائمة"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="relative flex-shrink-0">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-base sm:text-lg font-black shadow-inner border border-brand-100 overflow-hidden">
                    {selectedConv?.counterpartAvatar ? (
                      <img 
                        src={uploadsUrl(selectedConv.counterpartAvatar, "thumb")} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = uploadsUrl(selectedConv.counterpartAvatar, "full");
                        }}
                      />
                    ) : (
                      (selectedConv?.counterpartName || "?").slice(0, 1)
                    )}
                  </div>
                  {selectedConv?.counterpartIsOnline && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full border-2 border-white bg-green-500 shadow-sm"></span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm sm:text-base font-black text-gray-900 truncate leading-tight">{selectedConv?.counterpartName || ""}</span>
                    {selectedConv?.counterpartIsVerified && (
                      <span className="flex-shrink-0 text-blue-500 bg-blue-50 p-0.5 rounded-full" title="موثّق">
                        <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-bold truncate">
                    {selectedConv?.counterpartIsOnline ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        متصل الآن
                      </span>
                    ) : (
                      <span className="text-gray-400">آخر ظهور: {formatTime(selectedConv?.counterpartLastSeen)}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4 ml-1">
                <div className="hidden sm:flex flex-col items-end min-w-0 max-w-[200px]">
                  <div className="text-xs font-black text-gray-900 truncate w-full text-left">{getAdInfo(selectedConv).title}</div>
                  <button onClick={() => navigate(`/ad/${getAdInfo(selectedConv).id}`)} className="text-[10px] text-brand-600 font-black hover:text-brand-700 transition-colors flex items-center gap-0.5">
                    عرض الإعلان
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
                {getAdInfo(selectedConv).image && (
                  <button onClick={() => navigate(`/ad/${getAdInfo(selectedConv).id}`)} className="h-10 w-14 sm:h-12 sm:w-16 overflow-hidden rounded-xl border-2 border-gray-50 shadow-sm hover:border-brand-200 transition-all flex-shrink-0">
                    <img
                      src={uploadsUrl(getAdInfo(selectedConv).image)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                )}
                <div className="h-8 w-px bg-gray-100 hidden sm:block"></div>
                <div className="flex items-center gap-1 relative">
                  {/* Desktop Actions */}
                  <div className="hidden sm:flex items-center gap-1">
                    <button 
                      onClick={() => { setReportType("ad"); setReportOpen(true); }}
                      className="rounded-full p-2 text-gray-400 hover:bg-amber-50 hover:text-amber-500 transition-all flex-shrink-0"
                      title="إبلاغ عن الإعلان"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => { setReportType("user"); setReportOpen(true); }}
                      className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all flex-shrink-0"
                      title="إبلاغ عن المستخدم"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </button>
                  </div>

                  {/* Menu Button (Three Dots) */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowChatMenu(!showChatMenu)}
                      className={`rounded-full p-2 transition-all flex-shrink-0 ${showChatMenu ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}
                      title="خيارات إضافية"
                    >
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showChatMenu && (
                      <div className="absolute left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[60] animate-in fade-in zoom-in duration-200">
                        <button 
                          onClick={onMute}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={muted ? "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" : "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"} />
                          </svg>
                          {muted ? "إلغاء الكتم" : "كتم المحادثة"}
                        </button>
                        
                        <button 
                          onClick={onBlock}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${blocked ? "text-green-600 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          {blocked ? "إلغاء الحظر" : "حظر المستخدم"}
                        </button>

                        <div className="h-px bg-gray-100 my-1"></div>

                        <button 
                          onClick={() => { setReportType("user"); setReportOpen(true); setShowChatMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          إبلاغ عن مخالفة
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-gray-50/20">
              {/* الشراء الآمن ترويج داخل الدردشة */}
              {selectedConv && !isSeller && (
                <div className="max-w-md mx-auto mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/30 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center shadow-md shrink-0 animate-bounce-subtle">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-100 mb-0.5">نصيحة سوقك: استخدم الشراء الآمن 🛡️</h4>
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 leading-relaxed">
                        لحماية حقك وضمان استعادة أموالك، ننصحك دائماً بإتمام الصفقة عبر نظام "الشراء الآمن".
                      </p>
                      <button onClick={() => navigate("/secure-deal-explanation")} className="mt-2 text-[9px] font-black text-emerald-600 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm hover:bg-emerald-50 transition-all">تعرف على التفاصيل</button>
                    </div>
                  </div>
                </div>
              )}

              {showMsgsSpinner && <div className="flex items-center justify-center py-10"><LoadingSpinner /></div>}
              {!showMsgsSpinner && msgs.map((m, idx) => {
                const isMe = String(m.senderId?._id || m.senderId) === String(user?.id || user?._id);
                const showAvatar = idx === 0 || String(msgs[idx-1].senderId?._id || msgs[idx-1].senderId) !== String(m.senderId?._id || m.senderId);
                const isAdmin = m.senderId?.role === "admin";
                
                // تحديد دور الطرف الآخر في محادثات النزاع
                let roleLabel = "";
                let roleColor = "";
                
                if (isAdmin) {
                  roleLabel = "إدارة";
                  roleColor = "bg-red-600 text-white";
                } else if (selectedConv?.type === 'DISPUTE') {
                  const isSeller = String(m.senderId?._id || m.senderId) === String(selectedConv?.adId?.userId?._id || selectedConv?.adId?.userId);
                  roleLabel = isSeller ? "بائع" : "مشتري";
                  roleColor = isSeller ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700";
                }

                return (
                  <div
                    key={m._id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} group animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    {/* عرض الاسم والدور فوق الرسالة في الغرف الثلاثية */}
                    {selectedConv?.type === 'DISPUTE' && showAvatar && (
                      <div className={`flex items-center gap-1.5 mb-1 px-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                        <span className="text-[10px] font-black text-gray-500">{m.senderId?.name}</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${roleColor}`}>
                          {roleLabel}
                        </span>
                      </div>
                    )}

                    <div className={`flex items-end gap-2 max-w-[92%] sm:max-w-[85%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMe && (
                        <div 
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 mb-1 flex items-center justify-center text-[10px] sm:text-xs font-bold border-2 border-white shadow-sm transition-all hover:scale-110 overflow-hidden ${showAvatar ? "opacity-100" : "opacity-0"} ${isAdmin ? "bg-red-600 text-white" : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600"}`}
                          title={m.senderId?.name || selectedConv?.counterpartName}
                        >
                          {isAdmin ? (
                            "🛡️"
                          ) : m.senderId?.avatar ? (
                            <img src={uploadsUrl(m.senderId.avatar, "thumb")} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (m.senderId?.name || selectedConv?.counterpartName || "?").slice(0, 1)
                          )}
                        </div>
                      )}
                      <div
                        className={`relative rounded-2xl px-4 py-2.5 text-sm sm:text-base shadow-sm border transition-all ${
                          isMe
                            ? "bg-brand-600 border-brand-500 text-white rounded-br-none shadow-brand-100"
                            : isAdmin
                              ? "bg-red-50 border-red-100 text-gray-900 rounded-bl-none ring-1 ring-red-200/50"
                              : "bg-white border-gray-200 text-gray-900 rounded-bl-none shadow-gray-100"
                        }`}
                        onContextMenu={(e) => handleContextMenu(e, m._id, 'message')}
                        onTouchStart={(e) => handleTouchStart(e, m._id, 'message')}
                        onTouchEnd={handleTouchEnd}
                      >
                        {isAdmin && (
                          <div className="flex items-center gap-1 mb-1 border-b border-red-100 pb-1 text-[10px] font-black text-red-600 uppercase tracking-widest">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L10 1.55l7.834 3.35a1 1 0 01.666.927v4.264a10.859 10.859 0 01-2.104 6.42 10.94 10.94 0 01-5.08 3.991 1 1 0 01-.63 0 10.94 10.94 0 01-5.08-3.991 10.859 10.859 0 01-2.104-6.42V5.827a1 1 0 01.666-.927zM10 8a1 1 0 01.894.553l.618 1.236 1.364.198a1 1 0 01.554 1.706l-.986.962.233 1.359a1 1 0 01-1.45 1.054L10 14.466l-1.22.642a1 1 0 01-1.45-1.054l.233-1.359-.986-.962a1 1 0 01.554-1.706l1.364-.198.618-1.236A1 1 0 0110 8z" clipRule="evenodd" /></svg>
                            إشعار إداري
                          </div>
                        )}
                        {m.text && <div className="leading-relaxed whitespace-pre-wrap font-medium break-words">{renderTextWithLinks(m.text)}</div>}
                        {Array.isArray(m.images) && m.images.length > 0 && (
                          <div className={`mt-2 grid gap-2 ${m.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                            {m.images.map((img, i) => (
                              <button key={i} className="overflow-hidden rounded-xl border border-black/5 hover:opacity-90 transition-all hover:scale-[1.02]" onClick={() => { setLbSrc(uploadsUrl(img)); setLbOpen(true); }}>
                                <img src={uploadsUrl(img)} alt="" className="max-h-60 w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                        <div className={`mt-1.5 flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold ${isMe ? "text-brand-100 justify-start" : isAdmin ? "text-red-400 justify-end" : "text-gray-400 justify-end"}`}>
                          <span>{formatTime(m.createdAt)}</span>
                          {isMe && (
                            <span className="flex items-center">
                              {m.status === "read" ? (
                                <svg className="h-3.5 w-3.5 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM1 12l1.41 1.41L7.07 8.75l-1.41-1.41L1 12z" />
                                </svg>
                              ) : m.status === "delivered" ? (
                                <svg className="h-3.5 w-3.5 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM1 12l1.41 1.41L7.07 8.75l-1.41-1.41L1 12z" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5 text-white/40" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {isCounterTyping && (
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 animate-pulse mr-8">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                  </div>
                  {selectedConv?.counterpartName} يكتب الآن...
                </div>
              )}

              {showSoldReminder && !showCommissionMsg && (
                <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 my-2 mx-auto max-w-sm shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center mb-2 text-brand-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-brand-900 mb-4">هل تم بيع السلعة؟</p>
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={handleSold}
                        className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-xs font-black hover:bg-brand-700 transition-colors shadow-sm"
                      >
                        نعم تم البيع
                      </button>
                      <button 
                        onClick={handleStillAvailable}
                        className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-xl py-2.5 text-xs font-black hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        لا ما زالت متوفرة
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showCommissionMsg && (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-5 my-2 mx-auto max-w-md shadow-sm animate-in fade-in zoom-in">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 text-green-600">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-base font-black text-green-900 mb-2">تم تحديث حالة الإعلان</h4>
                    <p className="text-xs text-green-800 leading-relaxed font-bold mb-4">
                      تم تغيير حالة الإعلان إلى "تم البيع" بنجاح. يرجى العلم أن عمولة الموقع هي 1% من قيمة البيع. يمكنك دفع العمولة من خلال قسم العمولات في حسابك. شكراً لثقتك بنا!
                    </p>
                    <button 
                      onClick={() => setShowCommissionMsg(false)}
                      className="w-full bg-green-600 text-white rounded-xl py-2.5 text-xs font-black hover:bg-green-700 transition-colors shadow-sm"
                    >
                      حسناً، فهمت
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Input Area */}
            {blocked ? (
              <div className="border-t dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-6 text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="inline-flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-full border border-red-100 dark:border-red-900/30">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span className="text-sm font-bold">لا يمكنك إرسال رسائل لهذا المستخدم لأنك قمت بحظره</span>
                </div>
                <button 
                  onClick={onBlock}
                  className="block mx-auto mt-3 text-xs font-bold text-blue-600 hover:underline"
                >
                  إلغاء الحظر الآن
                </button>
              </div>
            ) : (
              <div className="bg-white border-t p-4 sm:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              {/* Quick Replies Row */}
              {showQuickReplies && !selectedConv?.isClosed && !getAdInfo(selectedConv).sold && getAdInfo(selectedConv).status !== "expired" && selectedConv?.type !== 'DISPUTE' && (
                <div className="flex flex-col gap-2 mb-3 animate-in slide-in-from-top-2 duration-200">
                  {!showAllQuickReplies ? (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                      {replies.slice(0, 5).map((reply, idx) => (
                        <div key={idx} className="flex-shrink-0 flex items-center gap-1 group/reply">
                          <button
                            className="rounded-full border border-brand-100 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-all shadow-sm"
                            onClick={() => handleQuickReply(reply)}
                          >
                            {reply.label}
                          </button>
                        </div>
                      ))}
                      {replies.length > 5 && (
                        <button 
                          className="flex-shrink-0 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-black text-brand-600 hover:bg-brand-50 transition-all shadow-sm"
                          onClick={() => setShowAllQuickReplies(true)}
                        >
                          المزيد +
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100 space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase">كل الردود الجاهزة</span>
                        <button onClick={() => setShowAllQuickReplies(false)} className="text-[10px] font-black text-brand-600 hover:underline">عرض أقل</button>
                      </div>
                      {Object.entries(groupedReplies).map(([category, items]) => (
                        <div key={category} className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                          <span className="text-[10px] font-black text-gray-500 whitespace-nowrap bg-white px-2 py-0.5 rounded-md border border-gray-100">{category}:</span>
                          {items.map((reply, idx) => (
                            <button
                              key={idx}
                              className="flex-shrink-0 rounded-full border border-gray-100 bg-white px-3 py-1 text-[11px] font-bold text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-all shadow-sm"
                              onClick={() => handleQuickReply(reply)}
                            >
                              {reply.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 no-scrollbar border-b border-gray-50">
                {!selectedConv?.isClosed && !getAdInfo(selectedConv).sold && getAdInfo(selectedConv).status !== "expired" && selectedConv?.type !== 'DISPUTE' && (
                  <button
                    className={`flex-shrink-0 flex items-center gap-1.5 rounded-full border transition-all px-3 py-1.5 text-[11px] font-black shadow-sm ${
                      showQuickReplies ? "bg-brand-600 border-brand-500 text-white" : "bg-brand-50 border-brand-100 text-brand-700 hover:bg-brand-100"
                    }`}
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    ردود جاهزة
                  </button>
                )}

                <button
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-black text-gray-700 hover:bg-brand-50 hover:border-brand-100 hover:text-brand-700 transition-all shadow-sm"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(async (pos) => {
                        const { latitude, longitude } = pos.coords;
                        const locUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                        try {
                          const res = await api.post(`/conversations/${selectedId}/messages`, { text: `📍 موقعي الحالي: ${locUrl}` });
                          setMsgs((m) => {
                            if (m.find(msg => String(msg._id) === String(res.data._id))) return m;
                            return [...m, res.data];
                          });
                          loadConvs();
                        } catch {}
                      });
                    }
                  }}
                >
                  <svg className="h-3.5 w-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  مشاركة الموقع
                </button>

                {String(selectedConv?.adId?.userId?._id || selectedConv?.adId?.userId) === String(user?.id || user?._id) && !selectedConv?.isClosed && selectedConv?.type !== 'DISPUTE' && (
                  <button
                    className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-[11px] font-black text-green-700 hover:bg-green-100 transition-all shadow-sm"
                    onClick={() => {
                      // Debug: confirm button click
                      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "جاري فتح نافذة إتمام البيع...", type: "info" } }));
                      setFinalPrice(selectedConv?.adId?.price ? String(selectedConv.adId.price) : "");
                      setFinalCurrency(selectedConv?.adId?.currency || "YER_ADEN");
                      setShowSoldModal(true);
                    }}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    تم البيع لهذا المشتري
                  </button>
                )}

              </div>

              {(selectedConv?.type === 'DISPUTE' ? selectedConv?.isClosed : (selectedConv?.isClosed || selectedConv?.adId?.sold || selectedConv?.adId?.status === "expired")) ? (
                <div className="rounded-xl bg-gray-50 p-4 text-center text-sm font-black text-gray-500 border-2 border-dashed border-gray-200">
                  {selectedConv?.type === 'DISPUTE' 
                    ? "تم إغلاق محادثة النزاع من قبل الإدارة"
                    : (selectedConv?.isClosed || selectedConv?.adId?.sold ? "تم إغلاق المحادثة لأن السلعة تم بيعها" : "المحادثة مغلقة لأن الإعلان انتهى")}
                </div>
              ) : (
                <div className="space-y-3">
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-brand-50 text-brand-700 rounded-lg px-2 py-1 border border-brand-100 animate-in zoom-in-50">
                          <span className="text-[10px] font-bold truncate max-w-[100px]">{f.name}</span>
                          <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      <button className="text-[10px] font-black text-red-500 hover:underline px-1" onClick={() => setFiles([])}>مسح الكل</button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative flex items-center bg-gray-100 rounded-2xl px-2">
                      <label className="p-2 rounded-full hover:bg-gray-200 text-gray-500 cursor-pointer transition-colors flex-shrink-0">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <input type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                      </label>
                      <textarea 
                        className="flex-1 bg-transparent border-none focus:ring-0 rounded-2xl px-2 py-2.5 text-sm font-medium transition-all resize-none min-h-[44px] max-h-32 custom-scrollbar" 
                        placeholder="اكتب رسالة..." 
                        rows={1}
                        value={text} 
                        onChange={onType}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                    </div>
                    <button 
                      className={`h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-2xl transition-all shadow-md mb-[1px] ${
                        text.trim() || files.length > 0 
                          ? "bg-brand-600 text-white hover:bg-brand-700 scale-105" 
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`} 
                      onClick={send}
                      disabled={!text.trim() && files.length === 0}
                    >
                      <svg className="w-5 h-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}

            {lbOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={() => setLbOpen(false)}>
                <button className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors" onClick={() => setLbOpen(false)}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <img src={lbSrc} alt="" className="max-h-[90vh] max-w-full rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()} />
              </div>
            )}
            {reportOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => { if(!reporting) setReportOpen(false); setReportSuccess(false); }}>
                <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100" onClick={(e) => e.stopPropagation()}>
                  {!reportSuccess ? (
                    <>
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`w-12 h-12 ${reportType === 'ad' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'} rounded-2xl flex items-center justify-center shadow-inner`}>
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-gray-900">
                            {reportType === "ad" ? "إبلاغ عن الإعلان" : "إبلاغ عن المستخدم"}
                          </h3>
                          <p className="text-sm text-gray-500 font-medium">ساعدنا في الحفاظ على أمان المنصة</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <MobileSelect 
                          label="الفئة"
                          value={reportCategory}
                          onChange={(e) => { setReportCategory(e.target.value); setReportReason(""); }}
                          options={REPORT_CONFIG[reportType].categories.map(c => ({ value: c.id, label: c.label }))}
                          placeholder="اختر فئة البلاغ..."
                        />

                        {reportCategory && (
                          <MobileSelect 
                            label="السبب المحدد"
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            options={[
                              ...REPORT_CONFIG[reportType].categories.find(c => c.id === reportCategory).reasons.map(r => ({ value: r, label: r })),
                              { value: "أخرى", label: "سبب آخر" }
                            ]}
                            placeholder="اختر السبب..."
                          />
                        )}

                        {(reportReason === "أخرى" || reportReason) && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="mb-2 block text-[10px] font-black text-gray-400 uppercase tracking-wider px-1">تفاصيل إضافية (اختياري)</label>
                            <textarea
                              className="ds-input w-full h-24 bg-gray-50 border-gray-100 font-medium focus:bg-white transition-all resize-none py-3"
                              placeholder="يرجى توضيح المزيد من التفاصيل لمساعدتنا في المراجعة..."
                              value={reportDetails}
                              onChange={(e) => setReportDetails(e.target.value)}
                            />
                          </div>
                        )}

                        <div className="flex gap-3 pt-2">
                          <button 
                            className={`flex-[2] h-12 rounded-2xl font-black transition-all shadow-md ${
                              !reportReason || reporting 
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                                : "bg-red-600 text-white hover:bg-red-700 active:scale-95"
                            }`} 
                            disabled={!reportReason || reporting}
                            onClick={async () => {
                              setReporting(true);
                              try {
                                const payload = { 
                                  category: REPORT_CONFIG[reportType].categories.find(c => c.id === reportCategory).label,
                                  reason: reportReason, 
                                  details: reportDetails 
                                };
                                if (reportType === "ad") {
                                  await api.post(`/ads/${selectedConv.adId._id}/report`, payload);
                                } else {
                                  await api.post(`/sellers/${selectedConv.counterpartId}/report`, payload);
                                }
                                setReportSuccess(true);
                              } catch {
                                window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تعذر إرسال البلاغ", type: "error" } }));
                              } finally {
                                setReporting(false);
                              }
                            }}
                          >
                            {reporting ? "جاري الإرسال..." : "إرسال البلاغ"}
                          </button>
                          <button 
                            className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-all" 
                            onClick={() => setReportOpen(false)}
                            disabled={reporting}
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 animate-in zoom-in-95">
                      <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 mb-2">تم استلام بلاغك</h3>
                      <p className="text-gray-500 font-medium mb-8">شكراً لمساعدتنا في الحفاظ على أمان المجتمع. سنقوم بمراجعة البلاغ واتخاذ الإجراء المناسب.</p>
                      
                      <div className="space-y-3">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">إجراءات إضافية مقترحة</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={async () => {
                              try {
                                await api.post(`/blocks/${selectedConv.counterpartId}`);
                                setBlocked(true);
                                window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم حظر المستخدم", type: "success" } }));
                              } catch {}
                            }}
                            disabled={blocked}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${blocked ? 'bg-gray-50 border-gray-100 text-gray-400' : 'bg-white border-red-50 text-red-600 hover:border-red-100 hover:bg-red-50'}`}
                          >
                            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            <span className="text-[10px] font-black uppercase">{blocked ? 'تم الحظر' : 'حظر المستخدم'}</span>
                          </button>
                          
                          <button 
                            onClick={async () => {
                              try {
                                const r = await api.patch(`/conversations/${selectedId}/mute`);
                                setMuted(!!r.data?.muted);
                                window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: r.data?.muted ? "تم كتم المحادثة" : "تم إلغاء كتم المحادثة", type: "success" } }));
                              } catch {}
                            }}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${muted ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-white border-gray-50 text-gray-600 hover:border-gray-100 hover:bg-gray-50'}`}
                          >
                            <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464L19.071 5M5 19l3.536-3.536M15.536 15.536L19.071 19M5 5l3.536 3.536" />
                            </svg>
                            <span className="text-[10px] font-black uppercase">{muted ? 'إلغاء الكتم' : 'كتم المحادثة'}</span>
                          </button>
                        </div>
                        <button 
                          className="w-full h-12 rounded-2xl bg-gray-900 text-white font-black hover:bg-gray-800 transition-all mt-4" 
                          onClick={() => { setReportOpen(false); setReportSuccess(false); }}
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sold Confirmation Modal */}
      {showSoldModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center shadow-inner">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">إتمام عملية البيع</h3>
                    <p className="text-xs font-bold text-gray-400">توثيق البيع لهذا المشتري</p>
                  </div>
                </div>
                <button onClick={() => setShowSoldModal(false)} className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-blue-700 leading-relaxed text-right">
                    ✨ مبروك على البيعة! توثيق السعر النهائي يساعد في رفع تقييمك كبائع موثوق ويضمن أرشفة المحادثة بشكل رسمي في سجلاتك.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">السعر النهائي المتفق عليه</label>
                  <div className="flex flex-col gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full h-16 bg-gray-50 border border-gray-100 rounded-2xl font-black text-2xl text-gray-900 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all px-4 outline-none text-center placeholder:text-gray-300"
                        placeholder="0.00"
                        value={finalPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow numbers and one decimal point
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setFinalPrice(val);
                          }
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "YER_ADEN", label: "ريال (عدن)" },
                        { value: "YER_SANAA", label: "ريال (صنعاء)" },
                        { value: "SAR", label: "ريال سعودي" },
                        { value: "USD", label: "دولار أمريكي" }
                      ].map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setFinalCurrency(c.value)}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black transition-all border ${
                            finalCurrency === c.value
                              ? "bg-brand-600 border-brand-500 text-white shadow-md shadow-brand-100"
                              : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between px-1">
                    <p className="text-[10px] font-bold text-gray-400">
                      سيتم احتساب رسوم خدمة رمزية (1%)
                    </p>
                    {Number(finalPrice) > 0 && (
                      <p className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                        {(Number(finalPrice) * 0.01).toLocaleString()} {finalCurrency === 'USD' ? '$' : 'ريال'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    disabled={isClosing || !finalPrice}
                    onClick={onConfirmSale}
                    className="flex-[2] h-14 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isClosing ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div> : "تأكيد البيع والإغلاق"}
                  </button>
                  <button 
                    disabled={isClosing}
                    onClick={() => setShowSoldModal(false)}
                    className="flex-1 h-14 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu UI */}
      {menu.visible && (
        <div 
          className="fixed z-[1000] bg-white border border-gray-200 shadow-xl rounded-2xl py-2 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${Math.min(menu.y, window.innerHeight - 150)}px`, left: `${Math.min(menu.x, window.innerWidth - 200)}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.type === 'conversation' && (
            <>
              {conversations.find(c => c._id === menu.targetId)?.isPinned ? (
                <button 
                  onClick={onUnpin}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                  إلغاء التثبيت
                </button>
              ) : (
                <button 
                  onClick={onPin}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                  تثبيت المحادثة
                </button>
              )}
              <div className="h-px bg-gray-100 my-1 mx-2"></div>
              <button 
                onClick={onDeleteConv}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                حذف المحادثة
              </button>
            </>
          )}
          {menu.type === 'message' && (
            <button 
              onClick={onDeleteMsg}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              حذف الرسالة
            </button>
          )}
        </div>
      )}
    </div>
  );
}