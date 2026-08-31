import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../api/axios.js';
import { useChat } from '../store/ChatContext.jsx';
import { useAuth } from '../store/AuthContext.jsx';
import { uploadsUrl } from '../lib/uploads.js';

export default function AdminSupportInbox() {
  const api = useApi();
  const { socket } = useChat();
  const { user: me } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeConv = conversations.find(c => c._id === activeConvId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchConversations();
    
    if (socket) {
      socket.on('support:new_message', (payload) => {
        const { conversationId, message, conversation } = payload;
        setConversations(prev => {
          const exists = prev.find(c => c._id === conversationId);
          let updated;
          
          if (exists) {
            updated = prev.map(c => {
              if (c._id === conversationId) {
                return {
                  ...c,
                  lastMessage: message.text || (message.images?.length ? "صورة" : ""),
                  lastMessageAt: message.createdAt,
                  adminUnreadCount: activeConvId === conversationId ? 0 : (c.adminUnreadCount || 0) + 1
                };
              }
              return c;
            });
          } else if (conversation) {
            // Add the new conversation to the list
            updated = [
              {
                ...conversation,
                adminUnreadCount: activeConvId === conversationId ? 0 : 1
              },
              ...prev
            ];
          } else {
            return prev;
          }
          
          // Sort by last message date
          return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        });

        if (activeConvId === conversationId) {
          setMessages(prev => {
            if (prev.find(m => m._id === message._id)) return prev;
            return [...prev, message];
          });
        }
      });

      socket.on('support:admin_new_message', (payload) => {
        const { conversationId, message } = payload;
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c._id === conversationId) {
              return {
                ...c,
                lastMessage: message.text || (message.images?.length ? "صورة" : ""),
                lastMessageAt: message.createdAt
              };
            }
            return c;
          });
          return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        });

        if (activeConvId === conversationId) {
          setMessages(prev => {
            if (prev.find(m => m._id === message._id)) return prev;
            return [...prev, message];
          });
        }
      });

      return () => {
        socket.off('support:new_message');
        socket.off('support:admin_new_message');
      };
    }
  }, [socket, activeConvId]);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
      // Reset unread count locally
      setConversations(prev => prev.map(c => c._id === activeConvId ? { ...c, adminUnreadCount: 0 } : c));
    }
  }, [activeConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/support/admin/all');
      setConversations(res.data);
    } catch (err) {
      console.error('Error fetching support conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      const res = await api.get(`/support/admin/${convId}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error('Error fetching support messages:', err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || !activeConvId || sending) return;

    setSending(true);
    const tempText = text;
    const tempFiles = files;
    setText('');
    setFiles([]);

    try {
      const formData = new FormData();
      if (tempText) formData.append('text', tempText);
      tempFiles.forEach(file => formData.append('images', file));

      const res = await api.post(`/support/admin/${activeConvId}/messages`, formData);
      // Add the message to the list immediately for better UX
      setMessages(prev => {
        if (prev.find(m => m._id === res.data._id)) return prev;
        return [...prev, res.data];
      });
    } catch (err) {
      console.error('Error sending support message:', err);
      // Restore text if failed
      setText(tempText);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles].slice(0, 5));
  };

  const toggleBlock = async (userId, currentDisabled) => {
    if (!window.confirm(currentDisabled ? "هل تريد إلغاء حظر هذا المستخدم؟" : "هل تريد حظر هذا المستخدم؟ لن يتمكن من تسجيل الدخول.")) return;
    try {
      await api.patch(`/admin/users/${userId}/disable`, { disabled: !currentDisabled });
      // Update local state
      setConversations(prev => prev.map(c => {
        if (c.userId?._id === userId) {
          return { ...c, userId: { ...c.userId, isDisabled: !currentDisabled } };
        }
        return c;
      }));
    } catch (err) {
      console.error('Error toggling block status:', err);
    }
  };

  const handleMoveToTrash = async () => {
    if (!activeConvId || !window.confirm("هل أنت متأكد من نقل هذه المحادثة إلى سلة المهملات؟")) return;
    try {
      await api.post(`/support/admin/${activeConvId}/trash`);
      setConversations(prev => prev.filter(c => c._id !== activeConvId));
      setActiveConvId(null);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم نقل المحادثة إلى سلة المهملات", type: "success" } }));
    } catch (err) {
      console.error('Error moving to trash:', err);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل نقل المحادثة", type: "error" } }));
    }
  };

  const renderTextWithLinks = (text, isMe) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            rel="noopener noreferrer"
            className={`${isMe ? 'text-blue-100 underline hover:text-white' : 'text-blue-600 underline hover:text-blue-800'} break-all`}
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
    <div className="flex h-[calc(100vh-140px)] overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 relative">
      {/* Conversations List */}
      <div className={`w-full md:w-1/3 border-l border-gray-100 flex flex-col ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-3">
            مراسلات الدعم
            <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-blue-100">
              {conversations.filter(c => c.adminUnreadCount > 0).length} غير مقروءة
            </span>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل المحادثات...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <p className="text-sm font-bold text-gray-400">لا توجد رسائل دعم حالياً</p>
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c._id}
                onClick={() => setActiveConvId(c._id)}
                className={`p-4 border-b border-gray-50 cursor-pointer transition-all hover:bg-gray-50 group relative ${activeConvId === c._id ? 'bg-blue-50/50' : ''}`}
              >
                {activeConvId === c._id && (
                  <div className="absolute right-0 top-3 bottom-3 w-1 bg-blue-600 rounded-l-full shadow-[2px_0_8px_rgba(37,99,235,0.4)]"></div>
                )}
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className={`text-sm font-black truncate max-w-[150px] transition-colors ${activeConvId === c._id ? 'text-blue-600' : 'text-gray-900'}`}>
                    {c.userId?.name || 'مستخدم غير معروف'}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400">
                    {new Date(c.lastMessageAt).toLocaleDateString("ar-YE", { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate flex-1">
                    {c.userId?.isDisabled && (
                      <span className="bg-red-50 text-red-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-100 uppercase flex-shrink-0">محظور</span>
                    )}
                    <p className={`text-xs truncate font-bold ${c.adminUnreadCount > 0 ? 'text-gray-900 font-black' : 'text-gray-500'}`}>
                      {c.lastMessage || 'بدأ المحادثة'}
                    </p>
                  </div>
                  {c.adminUnreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black h-5 w-5 flex items-center justify-center rounded-full animate-bounce shadow-lg shadow-red-200 flex-shrink-0 mr-2">
                      {c.adminUnreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-gray-50/30 ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
        {activeConvId ? (
          <>
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden p-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all active:scale-90"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="h-10 w-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <h3 className="text-sm font-black text-gray-900 leading-none mb-1">{activeConv?.userId?.name || 'مستخدم'}</h3>
                  <p className="text-[10px] font-bold text-gray-400">{activeConv?.userId?.phone || 'بدون هاتف'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleMoveToTrash}
                  className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all active:scale-95 group"
                  title="نقل إلى سلة المهملات"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button 
                  onClick={() => toggleBlock(activeConv?.userId?._id, activeConv?.userId?.isDisabled)}
                  className={`p-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-2 text-[11px] font-black ${
                    activeConv?.userId?.isDisabled 
                      ? 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white' 
                      : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                  }`}
                >
                  {activeConv?.userId?.isDisabled ? 'إلغاء الحظر' : 'حظر المستخدم'}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all hover:shadow-md ${
                      msg.senderRole === 'admin'
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100'
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                    }`}
                  >
                    {msg.text && <p className="whitespace-pre-wrap font-bold leading-relaxed">{renderTextWithLinks(msg.text, msg.senderRole === 'admin')}</p>}
                    
                    {msg.images && msg.images.length > 0 && (
                      <div className={`mt-3 grid gap-2 ${msg.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {msg.images.map((img, idx) => (
                          <a key={idx} href={uploadsUrl(img)} rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-gray-100/10">
                            <img 
                              src={uploadsUrl(img)} 
                              alt="attachment" 
                              className="w-full object-cover max-h-[300px] hover:scale-105 transition-transform duration-500"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    <div className={`mt-2 text-[9px] font-black uppercase tracking-wider ${msg.senderRole === 'admin' ? 'text-blue-100/70 text-right' : 'text-gray-400 text-left'}`}>
                      {new Date(msg.createdAt).toLocaleString("ar-YE", { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 space-y-4">
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {files.map((file, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(file)} alt="" className="h-16 w-16 object-cover rounded-xl border-2 border-white shadow-md" />
                      <button 
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors active:scale-90"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 p-2 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:border-blue-200 transition-all duration-300">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl hover:bg-white hover:text-blue-600 text-gray-400 transition-all active:scale-95 shadow-sm hover:shadow-md"
                  title="إرفاق صور"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*"
                  className="hidden"
                />
                
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="اكتب ردك هنا للمستخدم..."
                  className="flex-1 bg-transparent text-sm font-bold outline-none py-2 px-1"
                />
                
                <button
                  type="submit"
                  disabled={(!text.trim() && files.length === 0) || sending}
                  className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all active:scale-90 disabled:opacity-40 disabled:grayscale shadow-lg shadow-blue-200 flex items-center justify-center min-w-[50px]"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-32 h-32 bg-white rounded-[40px] shadow-2xl shadow-gray-200/50 flex items-center justify-center mb-8 border border-gray-50 relative">
              <div className="absolute inset-0 bg-blue-50/30 rounded-[40px] animate-pulse"></div>
              <svg className="h-14 w-14 text-blue-100 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">اختر محادثة من القائمة</h3>
            <p className="text-sm font-bold text-gray-400 max-w-[280px] leading-relaxed">يرجى اختيار محادثة لبدء الرد على استفسارات المستخدمين وتقديم الدعم الفني.</p>
          </div>
        )}
      </div>
    </div>
  );
}
