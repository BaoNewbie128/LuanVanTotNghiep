import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/NotificationCenter.css';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TYPE_META = {
  order: { label: 'Đơn hàng', icon: '📦' },
  voucher: { label: 'Voucher', icon: '🎁' },
  flash_sale: { label: 'Flash Sale', icon: '⚡' },
  support: { label: 'Hỗ trợ', icon: '💬' },
  return: { label: 'Đổi trả', icon: '↩️' },
  system: { label: 'Hệ thống', icon: '🔔' },
};

function NotificationCenterPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_URL}/notifications?per_page=50`, { headers });
      setNotifications(Array.isArray(response.data?.data) ? response.data.data : []);
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Không thể tải thông báo.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!token) navigate('/login');
    else fetchNotifications();
  }, [token, navigate, fetchNotifications]);

  const markAsRead = async (notification) => {
    if (notification.is_read) return;
    await axios.put(`${API_URL}/notifications/${notification.id}/read`, {}, { headers });
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    window.dispatchEvent(new Event('notificationsUpdated'));
  };

  const openNotification = async (notification) => {
    try {
      await markAsRead(notification);
      if (notification.action_url) navigate(notification.action_url);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể cập nhật thông báo.');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API_URL}/notifications/read-all`, {}, { headers });
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đánh dấu tất cả đã đọc.');
    }
  };

  const deleteNotification = async (event, id) => {
    event.stopPropagation();
    try {
      await axios.delete(`${API_URL}/notifications/${id}`, { headers });
      setNotifications((current) => current.filter((item) => item.id !== id));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể xóa thông báo.');
    }
  };

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const countByType = (type) => notifications.filter((item) => item.type === type).length;
  const visibleNotifications = notifications.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !item.is_read;
    return item.type === filter;
  });

  const filters = [
    ['all', 'Tất cả', notifications.length],
    ['unread', 'Chưa đọc', unreadCount],
    ['order', 'Đơn hàng', countByType('order')],
    ['voucher', 'Voucher', countByType('voucher')],
    ['flash_sale', 'Flash Sale', countByType('flash_sale')],
  ];

  return (
    <main className="notification-center-page">
      <header className="notification-center-header">
        <div><span>JDM WORLD UPDATES</span><h1>Trung tâm thông báo</h1><p>Theo dõi đơn hàng và không bỏ lỡ các ưu đãi mới nhất.</p></div>
        {unreadCount > 0 && <button type="button" className="notification-read-all" onClick={markAllAsRead}>✓ Đánh dấu tất cả đã đọc</button>}
      </header>

      <nav className="notification-filter-list" aria-label="Lọc thông báo">
        {filters.map(([value, label, count]) => (
          <button type="button" key={value} className={`notification-filter ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
            {label}<span>{count}</span>
          </button>
        ))}
      </nav>

      {error && <div className="notification-error">{error}<button type="button" onClick={fetchNotifications}>Thử lại</button></div>}
      {loading ? <div className="notification-state">Đang tải thông báo...</div> : visibleNotifications.length === 0 ? (
        <div className="notification-state notification-empty"><span>🔕</span><h2>Không có thông báo</h2><p>Các cập nhật phù hợp sẽ xuất hiện tại đây.</p></div>
      ) : (
        <section className="notification-feed">
          {visibleNotifications.map((notification) => {
            const meta = TYPE_META[notification.type] || TYPE_META.system;
            return (
              <article key={notification.id} className={`notification-card type-${notification.type} ${notification.is_read ? '' : 'unread'}`}
                onClick={() => openNotification(notification)}>
                <div className="notification-type-icon">{meta.icon}</div>
                <div className="notification-card-content">
                  <div className="notification-card-meta"><span>{meta.label}</span><time>{new Date(notification.created_at).toLocaleString('vi-VN')}</time></div>
                  <h2>{notification.title}</h2><p>{notification.content}</p>
                  {notification.action_url && <button type="button" className="notification-action-link">Xem chi tiết →</button>}
                </div>
                {!notification.is_read && <i className="notification-unread-dot" title="Chưa đọc" />}
                <button type="button" className="notification-delete" onClick={(event) => deleteNotification(event, notification.id)} aria-label="Xóa thông báo">×</button>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default NotificationCenterPage;
