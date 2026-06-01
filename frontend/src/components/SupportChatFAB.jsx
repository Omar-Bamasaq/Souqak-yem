import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/AuthContext.jsx';
import { useChat } from '../store/ChatContext.jsx';
import { useApi } from '../api/axios.js';
import { uploadsUrl } from '../lib/uploads.js';

export default function SupportChatFAB() {
  const { user } = useAuth();
  const { socket } = useChat();
  const api = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversation, setConversation] = useState(null);
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('app:open-support', handleOpen);
    return () => window.removeEventListener('app:open-support', handleOpen);
  }, []);

  const isAdmin = user?.role === 'admin';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isAdmin) {
      fetchMessages();
      setUnreadCount(0);
    }
  }, [isOpen, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;
    fetchConversation();
    
    if (socket) {
      const handleAdminMessage = (payload) => {
        const { message } = payload;
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        if (!isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      };

      const handleMyMessage = (payload) => {
        const { message } = payload;
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
      };

      socket.on('support:admin_message', handleAdminMessage);
      socket.on('support:my_new_message', handleMyMessage);

      return () => {
        socket.off('support:admin_message', handleAdminMessage);
        socket.off('support:my_new_message', handleMyMessage);
      };
    }
  }, [socket, isOpen, user, isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      scrollToBottom();
    }
  }, [messages, isAdmin]);

  const fetchConversation = async () => {
    try {
      const res = await api.get('/support/my');
      setConversation(res.data);
      setUnreadCount(res.data.userUnreadCount || 0);
    } catch (err) {
      console.error('Error fetching support conversation:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get('/support/my/messages');
      setMessages(res.data);
    } catch (err) {
      console.error('Error fetching support messages:', err);
    }
  };

  const handleDeleteConversation = async () => {
    if (!window.confirm("هل أنت متأكد من حذف هذه المحادثة؟ ستختفي من قائمتك ولكنها ستظل موجودة لدى الدعم الفني.")) return;
    try {
      await api.delete('/support/my');
      setIsOpen(false);
      setMessages([]);
      setConversation(null);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم حذف المحادثة بنجاح", type: "success" } }));
    } catch (err) {
      console.error('Error deleting support conversation:', err);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "فشل حذف المحادثة", type: "error" } }));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || sending) return;

    setSending(true);
    const tempText = text;
    const tempFiles = files;
    setText('');
    setFiles([]);

    try {
      const formData = new FormData();
      if (tempText) formData.append('text', tempText);
      tempFiles.forEach(file => formData.append('images', file));

      const res = await api.post('/support/my/messages', formData);
      // Add the message to the list immediately for better UX
      setMessages(prev => {
        if (prev.find(m => m._id === res.data._id)) return prev;
        return [...prev, res.data];
      });
    } catch (err) {
      console.error('Error sending support message:', err);
      setText(tempText);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles].slice(0, 5));
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
            target="_blank"
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

  // If user is not logged in or is admin, we don't show the floating button
  if (!user || isAdmin) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 md:bottom-8">
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 active:scale-90"
      >
        {isOpen ? (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-x-4 bottom-24 top-10 flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl transition-all md:absolute md:bottom-16 md:right-0 md:top-auto md:h-[500px] md:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-blue-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold">الدعم الفني</h3>
                <p className="text-[10px] opacity-80">نحن هنا لمساعدتك دائماً</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleDeleteConversation}
                className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                title="حذف المحادثة"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Close button for mobile inside the window */}
              <button 
                onClick={() => setIsOpen(false)}
                className="md:hidden p-1 rounded-full hover:bg-white/20"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
            <div className="rounded-xl bg-blue-50 p-3 text-center text-xs font-medium text-blue-700">
              أهلاً بك في دعم سوقك. كيف يمكننا مساعدتك اليوم؟
            </div>
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`flex ${msg.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    msg.senderRole === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                  }`}
                >
                  {msg.text && <p className="whitespace-pre-wrap">{renderTextWithLinks(msg.text, msg.senderRole === 'user')}</p>}
                  
                  {msg.images && msg.images.length > 0 && (
                    <div className={`mt-2 grid gap-2 ${msg.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {msg.images.map((img, idx) => (
                        <a key={idx} href={uploadsUrl(img)} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={uploadsUrl(img)} 
                            alt="attachment" 
                            className="rounded-lg max-h-40 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className={`mt-1 text-[9px] opacity-60 ${msg.senderRole === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="border-t bg-white p-3 space-y-2">
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {files.map((file, i) => (
                  <div key={i} className="relative group">
                    <img src={URL.createObjectURL(file)} alt="" className="h-12 w-12 object-cover rounded-lg border border-gray-200" />
                    <button 
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-100"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                title="إرفاق صور"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                placeholder="اكتب رسالتك هنا..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
              
              <button
                type="submit"
                disabled={(!text.trim() && files.length === 0) || sending}
                className="rounded-lg bg-blue-600 p-2 text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
              >
                <svg className="h-4 w-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
