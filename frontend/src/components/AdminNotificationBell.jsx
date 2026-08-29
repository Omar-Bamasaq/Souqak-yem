import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../api/axios.js';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin || 'https://api.souqak-yem.com';

export default function AdminNotificationBell() {
  const api = useApi();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const socketRef = useRef();
  const dropdownRef = useRef();

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/admin/notifications');
      setNotifications(res.data.items || []);
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/admin/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    // Setup Socket.IO
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current.on('admin_notification:new', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      
      // Play a subtle notification sound if needed
      // new Audio('/notification-sound.mp3').play().catch(() => {});
    });

    // Close dropdown on click outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/admin/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getNotificationLink = (notification) => {
    if (
      ['new_ad', 'ad_pending', 'ad_approved', 'ad_rejected'].includes(notification.type) ||
      notification.link === '/admin/products'
    ) {
      return '/admin/ads';
    }
    return notification.link || '/admin';
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'verification':
        return { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' };
      case 'featured':
        return { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' };
      case 'commission':
        return { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100' };
      case 'new_ad':
      case 'ad_pending':
      case 'ad_approved':
      case 'ad_rejected':
        return { bg: 'bg-cyan-50', icon: 'text-cyan-600', border: 'border-cyan-100' };
      case 'new_user':
      case 'user_verified':
      case 'user_banned':
        return { bg: 'bg-pink-50', icon: 'text-pink-600', border: 'border-pink-100' };
      case 'new_order':
      case 'order_updated':
        return { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' };
      case 'new_support_ticket':
      case 'support_reply':
        return { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' };
      case 'new_platform_review':
      case 'admin_reply_to_review':
        return { bg: 'bg-lime-50', icon: 'text-lime-600', border: 'border-lime-100' };
      case 'new_ad_report':
      case 'report_handled':
        return { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-100' };
      default:
        return { bg: 'bg-gray-50', icon: 'text-gray-600', border: 'border-gray-100' };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <svg
          className="w-6 h-6 text-gray-600"
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
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full border-2 border-white">
            {unreadCount > 99 ? '+99' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-20 md:absolute md:inset-auto md:left-0 md:mt-2 w-auto md:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-sm">الإشعارات</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                >
                  تحديد الكل كمقروء
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)}
                className="md:hidden p-1 rounded-full hover:bg-gray-200 text-gray-400"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar">
            {notifications.length > 0 ? (
              notifications.map((notif) => {
                const styles = getTypeStyles(notif.type);
                return (
                  <Link
                    key={notif._id}
                    to={getNotificationLink(notif)}
                    onClick={() => {
                      markAsRead(notif._id);
                      setIsOpen(false);
                    }}
                    className={`block p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !notif.isRead ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${styles.bg} flex items-center justify-center border ${styles.border}`}>
                        {notif.type === 'verification' && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-7.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        )}
                        {notif.type === 'featured' && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        )}
                        {notif.type === 'commission' && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" /></svg>
                        )}
                        {(notif.type === 'new_ad' || notif.type === 'ad_pending' || notif.type === 'ad_approved' || notif.type === 'ad_rejected') && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h18v18H3V3zm2 2v14h14V5H5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8M8 11h8M8 15h5" /></svg>
                        )}
                        {(notif.type === 'new_user' || notif.type === 'user_verified' || notif.type === 'user_banned') && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        )}
                        {(notif.type === 'new_order' || notif.type === 'order_updated') && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        )}
                        {(notif.type === 'new_support_ticket' || notif.type === 'support_reply') && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" /></svg>
                        )}
                        {(notif.type === 'new_platform_review' || notif.type === 'admin_reply_to_review') && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        )}
                        {(notif.type === 'new_ad_report' || notif.type === 'report_handled') && (
                          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{notif.title}</p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ar })}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400 font-medium">لا توجد إشعارات حالياً</p>
              </div>
            )}
          </div>
          
          <Link
            to="/admin/audit-logs"
            onClick={() => setIsOpen(false)}
            className="block p-3 text-center text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-100"
          >
            عرض سجل التدقيق
          </Link>
        </div>
      )}
    </div>
  );
}
