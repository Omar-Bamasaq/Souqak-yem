import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../api/axios.js';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import { useChat } from '../store/ChatContext.jsx';

export default function UserNotificationBell({ mobile = false }) {
  const { user } = useAuth();
  const api = useApi();
  const { socket } = useChat();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef();

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.items || []); // Use items from the paginated response
    } catch (err) {
      console.error('Error fetching user notifications:', err);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error('Error fetching user unread count:', err);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchUnreadCount();

    if (socket) {
      const handleNewNotification = (data) => {
        // The event payload from backend is { notification: {...} }
        const newNotif = data.notification;
        if (newNotif) {
          setNotifications((prev) => [newNotif, ...prev.slice(0, 19)]);
          setUnreadCount((prev) => prev + 1);
          
          // Play notification sound if possible
          try {
            const audio = new Audio('/notification-pop.mp3');
            audio.play().catch(() => {});
          } catch {}
        }
      };

      socket.on('notification:new', handleNewNotification);
      return () => {
        socket.off('notification:new', handleNewNotification);
      };
    }
  }, [user, socket]);

  useEffect(() => {
    // Close dropdown on click outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking user notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all user notifications as read:', err);
    }
  };

  const getLinkForNotification = (notif) => {
    switch (notif.type) {
      case 'ad_status':
        // If it's a seller review notification, go to seller public profile reviews tab
        if (notif.title?.includes('تقييم') || notif.body?.includes('تقييم')) {
          return `/s/${user.id || user._id}?tab=reviews`;
        }
        return `/ad/${notif.data?.adId}`;
      case 'comment':
        return `/ad/${notif.data?.adId}`;
      case 'message':
        return `/messages?chat=${notif.data?.conversationId}`;
      case 'purchase_approved':
      case 'purchase_rejected':
      case 'commission_reminder':
        return `/seller/commissions`;
      case 'verification_approved':
      case 'verification_rejected':
        return `/seller/dashboard`;
      default:
        return '/notifications';
    }
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'ad_status':
        return { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' };
      case 'comment':
        return { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100' };
      case 'purchase_approved':
        return { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100' };
      case 'purchase_rejected':
      case 'commission_reminder':
        return { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-100' };
      default:
        return { bg: 'bg-gray-50', icon: 'text-gray-600', border: 'border-gray-100' };
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full hover:bg-gray-100 transition-colors ${mobile ? 'text-gray-500' : 'text-gray-600'}`}
      >
        <svg
          className={`${mobile ? 'w-7 h-7' : 'w-6 h-6'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          ></path>
        </svg>
        {unreadCount > 0 && (
          <span className={`absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full border-2 border-white`}>
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute ${mobile ? '-left-12' : 'left-0'} mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
          <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-sm">الإشعارات</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-[350px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notif) => {
                const styles = getTypeStyles(notif.type);
                return (
                  <Link
                    key={notif._id}
                    to={getLinkForNotification(notif)}
                    onClick={() => {
                      markAsRead(notif._id);
                      setIsOpen(false);
                    }}
                    className={`block p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !notif.isRead ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${styles.bg} flex items-center justify-center border ${styles.border}`}>
                        <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{notif.title}</p>
                          <span className="text-[9px] text-gray-400 whitespace-nowrap">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ar })}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{notif.body}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="p-10 text-center">
                <p className="text-xs text-gray-400 font-medium">لا توجد إشعارات حالياً</p>
              </div>
            )}
          </div>
          
          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="block p-3 text-center text-[11px] font-bold text-blue-600 bg-blue-50/30 hover:bg-blue-50 transition-colors border-t border-gray-100"
          >
            عرض جميع الإشعارات
          </Link>
        </div>
      )}
    </div>
  );
}
