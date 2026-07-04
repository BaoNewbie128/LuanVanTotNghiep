import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../../styles/StaffNotificationsPage.css';

const filters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'low_stock', label: 'Sắp hết hàng' },
  { key: 'pending_order', label: 'Chờ xử lý quá lâu' },
  { key: 'shipment_issue', label: 'Lỗi vận chuyển' },
];

const iconByType = {
  low_stock: '📉',
  pending_order: '⏳',
  shipment_issue: '🚚',
};

function StaffNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNotifications = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await axios.get('/api/staff/notifications', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setNotifications(response.data?.data || []);
        setSummary(response.data?.summary || null);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Không thể tải thông báo vận hành.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') {
      return notifications;
    }

    return notifications.filter((item) => item.type === filter);
  }, [filter, notifications]);

  return (
    <section className="staff-operational-notifications">
      <div className="staff-operational-notifications__intro">
        <div>
          <h2>Thông báo vận hành</h2>
          <p>
            Bảng cảnh báo dành cho nhân viên để phát hiện nhanh hàng sắp hết, đơn chờ xử lý quá lâu,
            hoặc vấn đề giao vận cần xử lý ngay.
          </p>
        </div>
        <div className="staff-operational-notifications__meta">Giai đoạn 3.1</div>
      </div>

      {summary && (
        <div className="staff-operational-notifications__summary">
          <article className="staff-operational-notifications__card">
            <span>Tổng cảnh báo</span>
            <strong>{summary.total}</strong>
          </article>
          <article className="staff-operational-notifications__card">
            <span>Sắp hết hàng</span>
            <strong>{summary.low_stock}</strong>
          </article>
          <article className="staff-operational-notifications__card">
            <span>Chờ xử lý quá lâu</span>
            <strong>{summary.pending_order}</strong>
          </article>
          <article className="staff-operational-notifications__card">
            <span>Lỗi vận chuyển</span>
            <strong>{summary.shipment_issue}</strong>
          </article>
        </div>
      )}

      <div className="staff-operational-notifications__filters">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`staff-operational-notifications__filter${filter === item.key ? ' staff-operational-notifications__filter--active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <div className="staff-operational-notifications__empty">Đang tải thông báo vận hành...</div>}
      {!loading && error && <div className="staff-operational-notifications__error">{error}</div>}
      {!loading && !error && filteredNotifications.length === 0 && (
        <div className="staff-operational-notifications__empty">Không có cảnh báo vận hành nào với bộ lọc hiện tại.</div>
      )}

      {!loading && !error && filteredNotifications.length > 0 && (
        <div className="staff-operational-notifications__list">
          {filteredNotifications.map((item) => (
            <article key={item.id} className={`staff-operational-notifications__item staff-operational-notifications__item--${item.type}`}>
              <div className="staff-operational-notifications__icon">{iconByType[item.type] || '🔔'}</div>
              <div className="staff-operational-notifications__content">
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                <span>
                  {item.created_at ? new Date(item.created_at).toLocaleString('vi-VN') : 'Không có'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default StaffNotificationsPage;
