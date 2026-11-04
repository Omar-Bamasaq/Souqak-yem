import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../api/axios.js';
import { useChat } from '../store/ChatContext.jsx';
import { useAuth } from '../store/AuthContext.jsx';
import PrivateMessageImage from '../components/PrivateMessageImage.jsx';
import MessageText from '../components/MessageText.jsx';

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
  const [activeSection, setActiveSection] = useState('messages');
  const [faqs, setFaqs] = useState([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqError, setFaqError] = useState('');
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [faqDraft, setFaqDraft] = useState({ question: '', answer: '', category: '', keywords: '' });
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

  const fetchSupportFaqs = async () => {
    setFaqLoading(true);
    setFaqError('');
    try {
      const res = await api.get('/support/admin/faqs');
      setFaqs(res.data);
    } catch (err) {
      console.error('Error fetching support FAQs:', err);
      setFaqError('تعذر تحميل الأسئلة الشائعة.');
    } finally {
      setFaqLoading(false);
    }
  };

  const startEditingFaq = (faq) => {
    setEditingFaqId(faq?._id || null);
    setFaqDraft(faq
      ? {
          question: faq.question,
          answer: faq.answer,
          category: faq.category || '',
          keywords: (faq.keywords || []).join('، ')
        }
      : { question: '', answer: '', category: '', keywords: '' });
    setFaqError('');
  };

  const handleSaveFaq = async (e) => {
    e.preventDefault();
    if (faqSaving) return;
    setFaqSaving(true);
    setFaqError('');
    const payload = {
      question: faqDraft.question.trim(),
      answer: faqDraft.answer.trim(),
      category: faqDraft.category.trim() || 'عام',
      keywords: faqDraft.keywords.split(/[,،\n]/).map((keyword) => keyword.trim()).filter(Boolean)
    };
    try {
      const response = editingFaqId
        ? await api.patch(`/support/admin/faqs/${editingFaqId}`, payload)
        : await api.post('/support/admin/faqs', payload);
      setFaqs((previous) => {
        const updated = editingFaqId
          ? previous.map((faq) => faq._id === editingFaqId ? response.data : faq)
          : [...previous, response.data];
        return updated.sort((a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question, 'ar'));
      });
      startEditingFaq(null);
    } catch (err) {
      console.error('Error saving support FAQ:', err);
      setFaqError(err.response?.data?.error || 'تعذر حفظ السؤال الشائع.');
    } finally {
      setFaqSaving(false);
    }
  };

  const handleToggleFaq = async (faq) => {
    try {
      const response = await api.patch(`/support/admin/faqs/${faq._id}`, { active: !faq.active });
      setFaqs((previous) => previous.map((item) => item._id === faq._id ? response.data : item));
    } catch (err) {
      console.error('Error updating support FAQ status:', err);
      setFaqError(err.response?.data?.error || 'تعذر تحديث حالة السؤال.');
    }
  };

  const handleDeleteFaq = async (faq) => {
    if (!window.confirm('هل تريد حذف هذا السؤال الشائع؟')) return;
    try {
      await api.delete(`/support/admin/faqs/${faq._id}`);
      setFaqs((previous) => previous.filter((item) => item._id !== faq._id));
    } catch (err) {
      console.error('Error deleting support FAQ:', err);
      setFaqError(err.response?.data?.error || 'تعذر حذف السؤال الشائع.');
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

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm relative">
      <div className="flex gap-2 border-b border-gray-100 bg-gray-50/50 p-3">
        <button
          type="button"
          onClick={() => setActiveSection('messages')}
          className={`rounded-lg px-4 py-2 text-xs font-black transition-colors ${activeSection === 'messages' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-blue-50'}`}
        >
          مراسلات الدعم
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSection('faqs');
            fetchSupportFaqs();
          }}
          className={`rounded-lg px-4 py-2 text-xs font-black transition-colors ${activeSection === 'faqs' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-blue-50'}`}
        >
          الأسئلة الشائعة والبوت
        </button>
      </div>
      {activeSection === 'messages' ? (
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
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
                    {msg.text && <p className="whitespace-pre-wrap font-bold leading-relaxed"><MessageText text={msg.text} linkClassName={`${msg.senderRole === "admin" ? "text-blue-100 underline hover:text-white" : "text-blue-600 underline hover:text-blue-800"} break-all`} /></p>}
                    
                    {msg.images && msg.images.length > 0 && (
                      <div className={`mt-3 grid gap-2 ${msg.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {msg.images.map((img, idx) => (
                          <div
                            key={idx}
                            className="block overflow-hidden rounded-xl border border-gray-100/10"
                          >
                            <PrivateMessageImage
                              api={api}
                              kind="support"
                              conversationId={msg.conversationId || activeConvId}
                              messageId={msg._id}
                              imageReference={img}
                              alt="attachment"
                              className="w-full object-cover max-h-[300px] hover:scale-105 transition-transform duration-500"
                              onOpen={(url) => window.open(url, "_blank", "noopener,noreferrer")}
                            />
                          </div>
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
      ) : (
        <section className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            <header>
              <h2 className="text-xl font-black text-gray-900">إدارة الأسئلة الشائعة</h2>
              <p className="mt-1 text-sm text-gray-500">تُستخدم هذه الإجابات في المساعد الفوري دون الحاجة إلى ذكاء اصطناعي.</p>
            </header>

            <form onSubmit={handleSaveFaq} className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:p-6">
              <h3 className="font-black text-gray-800">{editingFaqId ? 'تعديل سؤال شائع' : 'إضافة سؤال شائع'}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-bold text-gray-700">
                  السؤال
                  <input
                    required
                    maxLength={180}
                    value={faqDraft.question}
                    onChange={(e) => setFaqDraft((draft) => ({ ...draft, question: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
                  />
                </label>
                <label className="space-y-1 text-sm font-bold text-gray-700">
                  القسم
                  <input
                    maxLength={60}
                    value={faqDraft.category}
                    onChange={(e) => setFaqDraft((draft) => ({ ...draft, category: e.target.value }))}
                    placeholder="مثال: الحساب، الإعلانات"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm font-bold text-gray-700">
                الإجابة
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={faqDraft.answer}
                  onChange={(e) => setFaqDraft((draft) => ({ ...draft, answer: e.target.value }))}
                  className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>
              <label className="block space-y-1 text-sm font-bold text-gray-700">
                كلمات مفتاحية ومرادفات (افصل بينها بفاصلة)
                <input
                  value={faqDraft.keywords}
                  onChange={(e) => setFaqDraft((draft) => ({ ...draft, keywords: e.target.value }))}
                  placeholder="نسيت كلمة المرور، استعادة الحساب"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>
              {faqError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{faqError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={faqSaving}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {faqSaving ? 'جارٍ الحفظ...' : editingFaqId ? 'حفظ التعديلات' : 'إضافة السؤال'}
                </button>
                {editingFaqId && (
                  <button
                    type="button"
                    onClick={() => startEditingFaq(null)}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-600"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-3">
              <h3 className="font-black text-gray-800">الأسئلة الحالية</h3>
              {faqLoading ? (
                <p className="py-8 text-center text-sm text-gray-400">جاري تحميل الأسئلة...</p>
              ) : faqs.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">لا توجد أسئلة شائعة.</p>
              ) : faqs.map((faq) => (
                <article key={faq._id} className={`rounded-xl border p-4 ${faq.active ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{faq.category || 'عام'}</span>
                        {!faq.active && <span className="rounded-full bg-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600">معطل</span>}
                      </div>
                      <h4 className="font-black text-gray-900">{faq.question}</h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{faq.answer}</p>
                      {!!faq.keywords?.length && <p className="mt-2 text-xs text-gray-400">مرادفات: {faq.keywords.join('، ')}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEditingFaq(faq)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">تعديل</button>
                      <button type="button" onClick={() => handleToggleFaq(faq)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">{faq.active ? 'تعطيل' : 'تفعيل'}</button>
                      {!faq.key?.startsWith('default-') && <button type="button" onClick={() => handleDeleteFaq(faq)} className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">حذف</button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
