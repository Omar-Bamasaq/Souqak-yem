import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";
import { useApi } from "../api/axios.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin || "https://api.souqak-yem.com";
const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const api = useApi();
  const [unread, setUnread] = useState(0);
  const [socket, setSocket] = useState(null);
  const activeProductRef = useRef(null);

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await api.get("/conversations/unread-count");
      setUnread(res.data.count);
    } catch (err) {
      console.error("Error fetching unread chat count:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    } else {
      setUnread(0);
    }
  }, [user]);

  useEffect(() => {
    if (!socket && user) {
      const newSocket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        withCredentials: true,
      });

      newSocket.on("connect", () => {
        const uid = user?.id || user?._id;
        if (uid) {
          newSocket.emit("join_user", { userId: uid });
        }
      });

      newSocket.on("chat:new_message", (payload) => {
        const { productId, message } = payload || {};
        const me = user?.id || user?._id;
        if (activeProductRef.current === productId) return;
        if (message?.sender && message.sender !== me) setUnread((c) => c + 1);
      });

      newSocket.on("notification:new", (payload) => {
        try {
          window.dispatchEvent(new CustomEvent("notification:new", { detail: payload?.notification || payload || {} }));
        } catch {}
      });

      newSocket.on("conversation:new_message", (payload) => {
        const { message, conversationId } = payload || {};
        const me = user?.id || user?._id;
        
        // Update unread count if not in the active chat
        if (message && String(message.senderId) !== String(me)) {
          if (activeProductRef.current !== conversationId) {
            setUnread(prev => prev + 1);
          }

          newSocket.emit("message:delivered", { 
            messageId: message._id, 
            conversationId, 
            senderId: message.senderId 
          });
        }
        try {
          window.dispatchEvent(new CustomEvent("conversation:new_message", { detail: payload || {} }));
        } catch {}
      });

      newSocket.on("conversation:read", (payload) => {
        // When user reads messages (possibly on another device/tab), refresh count
        fetchUnreadCount();
        try {
          window.dispatchEvent(new CustomEvent("conversation:read", { detail: payload || {} }));
        } catch {}
      });

      newSocket.on("user:status", (payload) => {
        try {
          window.dispatchEvent(new CustomEvent("user:status", { detail: payload || {} }));
        } catch {}
      });

      setSocket(newSocket);
    }
  }, [user, socket]);

  const join = (productId) => {
    activeProductRef.current = productId;
    socket?.emit("join", { productId });
    setUnread(0);
  };

  // Re-join user room if user changes but socket remains
  useEffect(() => {
    const uid = user?.id || user?._id;
    if (uid && socket && socket.connected) {
      socket.emit("join_user", { userId: uid });
    }
  }, [user, socket]);

  const value = useMemo(() => ({ socket, unread, setUnread, join }), [socket, unread]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  return useContext(ChatContext);
}
