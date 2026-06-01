import React, { useState, useEffect } from "react";
import { useApi } from "../api/axios.js";

export default function AdminMessaging() {
  const api = useApi();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Form state
  const [targetType, setTargetType] = useState("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearch.length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin-messages/admin/list");
      setMessages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    setIsSearching(true);
    try {
      const res = await api.get(`/admin-messages/users/search?q=${userSearch}`);
      setSearchResults(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddUser = (user) => {
    if (!selectedUsers.find((u) => u._id === user._id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUserSearch("");
    setSearchResults([]);
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) return;
    if (targetType === "specific" && selectedUsers.length === 0) return;

    setIsSending(true);
    try {
      await api.post("/admin-messages", {
        targetType,
        title,
        content,
        isPinned,
        recipients: targetType === "specific" ? selectedUsers.map((u) => u._id) : [],
      });
      
      // Reset form
      setTitle("");
      setContent("");
      setSelectedUsers([]);
      setTargetType("all");
      
      // Refresh list
      loadMessages();
      
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: "تم إرسال الرسالة بنجاح", type: "success" } 
      }));
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: "خطأ في إرسال الرسالة", type: "error" } 
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الرسالة؟")) return;
    try {
      await api.delete(`/admin-messages/${id}`);
      setMessages(messages.filter((m) => m._id !== id));
      window.dispatchEvent(new CustomEvent("admin:toast", { 
        detail: { message: "تم حذف الرسالة", type: "success" } 
      }));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل الرسائل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">مراسلة المستخدمين</h1>
        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
      </div>

      {/* New Message Form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">إرسال رسالة جديدة</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">نوع الاستهداف</label>
              <select
                className="block w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm font-bold text-gray-700 transition-all focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/5"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
              >
                <option value="all">الكل (بث عام)</option>
                <option value="specific">مستخدمين محددين</option>
              </select>
            </div>
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 transition-all peer-checked:bg-blue-600"></div>
                  <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-all peer-checked:left-6"></div>
                </div>
                <span className="text-xs font-black text-gray-600 group-hover:text-gray-900 transition-colors">تثبيت في أعلى الرسائل</span>
              </label>
            </div>
          </div>

          {targetType === "specific" && (
            <div className="space-y-3 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">البحث عن المستخدمين</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="الاسم، البريد أو الهاتف..."
                  className="block w-full rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-all focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/5"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                {isSearching && (
                  <div className="absolute left-4 top-3.5">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-gray-100 bg-white shadow-xl">
                    {searchResults.map((user) => (
                      <button
                        key={user._id}
                        type="button"
                        className="flex w-full items-center justify-between px-5 py-3 text-right hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                        onClick={() => handleAddUser(user)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-900">{user.name}</span>
                          <span className="text-[10px] font-bold text-gray-400">{user.phone || user.email}</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedUsers.map((user) => (
                  <span
                    key={user._id}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 border border-blue-100 group"
                  >
                    {user.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(user._id)}
                      className="text-blue-400 hover:text-blue-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">عنوان الرسالة</label>
            <input
              type="text"
              required
              placeholder="مثال: تحديث شروط الاستخدام"
              className="block w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm font-bold text-gray-700 transition-all focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">محتوى الرسالة</label>
            <textarea
              required
              rows="4"
              placeholder="اكتب تفاصيل الرسالة هنا..."
              className="block w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm font-bold text-gray-700 transition-all focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/5 resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            ></textarea>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSending}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 hover:shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                  <span>جاري الإرسال...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>إرسال الرسالة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* History List */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-50 bg-gray-50/30 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">سجل الرسائل المرسلة</h2>
          <span className="text-[10px] font-black text-gray-400 bg-white px-2.5 py-1 rounded-lg border border-gray-100">
            {messages.length} رسالة
          </span>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-right">
            <thead>
              <tr className="border-b border-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4">الرسالة</th>
                <th className="px-6 py-4">الاستهداف</th>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-xs font-black text-gray-400 italic">لا توجد رسائل مرسلة بعد</td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg._id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-black text-gray-900">{msg.title}</div>
                      <div className="max-w-xs truncate text-[10px] font-bold text-gray-400 mt-0.5">{msg.content}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black border ${
                          msg.targetType === "all" 
                            ? "bg-green-50 text-green-700 border-green-100" 
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}>
                          {msg.targetType === "all" ? "الكل" : `مخصص (${msg.recipients?.length || 0})`}
                        </span>
                        {msg.isPinned && (
                          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 border border-amber-100">
                            مثبتة
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-gray-500">
                        {new Date(msg.createdAt).toLocaleDateString("ar-YE", { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-left">
                      <button
                        onClick={() => handleDelete(msg._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-gray-50">
          {messages.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs font-black text-gray-400 italic">لا توجد رسائل مرسلة بعد</div>
          ) : (
            messages.map((msg) => (
              <div key={msg._id} className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-gray-900">{msg.title}</h3>
                    <p className="text-[10px] font-bold text-gray-400 line-clamp-2">{msg.content}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(msg._id)}
                    className="p-2 text-red-600 bg-red-50 rounded-xl border border-red-100"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black border ${
                      msg.targetType === "all" 
                        ? "bg-green-50 text-green-700 border-green-100" 
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    }`}>
                      {msg.targetType === "all" ? "الكل" : `مخصص (${msg.recipients?.length || 0})`}
                    </span>
                    {msg.isPinned && (
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-700 border border-amber-100">
                        مثبتة
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">
                    {new Date(msg.createdAt).toLocaleDateString("ar-YE")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
