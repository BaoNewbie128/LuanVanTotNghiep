import { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminOperations.css';

const meta = { low_stock: ['Sắp hết hàng', '📦'], payment_failed: ['Thanh toán lỗi', '💳'], system: ['Hệ thống', '⚠️'] };
const severityLabels = { critical: 'Nghiêm trọng', warning: 'Cảnh báo', info: 'Thông tin' };

export default function AdminSystemNotificationsPage() {
  const token = localStorage.getItem('token');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/admin/notifications/system', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { setItems(response.data.data || []); setSummary(response.data.summary || {}); })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Không thể tải cảnh báo.'));
  }, [token]);

  const visible = filter === 'all' ? items : filter === 'critical' ? items.filter((item) => item.severity === 'critical') : items.filter((item) => item.type === filter);

  return <section className="admin-ops-page">
    <header className="admin-page-heading"><div><small>TRUNG TÂM ĐIỀU HÀNH</small><h1>Trung tâm cảnh báo</h1><p>Sắp hết hàng, thanh toán thất bại và bất thường vận hành.</p></div></header>
    <div className="admin-kpi-row"><button onClick={() => setFilter('all')}><strong>{summary.total || 0}</strong><span>Tất cả</span></button><button onClick={() => setFilter('critical')}><strong>{summary.critical || 0}</strong><span>Nghiêm trọng</span></button><button onClick={() => setFilter('low_stock')}><strong>{summary.low_stock || 0}</strong><span>Tồn kho</span></button><button onClick={() => setFilter('payment_failed')}><strong>{summary.payment_failed || 0}</strong><span>Thanh toán lỗi</span></button><button onClick={() => setFilter('system')}><strong>{summary.system || 0}</strong><span>Hệ thống</span></button></div>
    {error && <div className="admin-alert">{error}</div>}
    <div className="admin-warning-list">{visible.length === 0 ? <div className="admin-state">Không có cảnh báo trong mục này.</div> : visible.map((item) => <article className={item.severity} key={item.id}><span>{meta[item.type]?.[1] || '⚠️'}</span><div><small>{meta[item.type]?.[0] || 'Hệ thống'} · {severityLabels[item.severity] || item.severity}</small><h2>{item.title}</h2><p>{item.message}</p></div><time>{item.created_at ? new Date(item.created_at).toLocaleString('vi-VN') : '—'}</time></article>)}</div>
  </section>;
}
