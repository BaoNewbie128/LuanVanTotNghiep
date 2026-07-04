import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import './AdminOperations.css';

const typeLabels = { refund: 'Hoàn tiền', return: 'Trả hàng', exchange: 'Đổi hàng' };
const statusLabels = { pending: 'Chờ xử lý', approved: 'Đã duyệt', rejected: 'Từ chối', completed: 'Hoàn tất' };

export default function AdminReturnsPage() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ status: 'pending', resolution_note: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/api/admin/returns', {
        headers: { Authorization: `Bearer ${token}` },
        params: { status, request_type: type },
      });
      setItems(response.data?.data?.data || []);
      setSummary(response.data?.summary || {});
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải yêu cầu.');
    } finally {
      setLoading(false);
    }
  }, [token, status, type]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await axios.put(`/api/admin/returns/${editing.id}`, form, { headers });
      setEditing(null);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể cập nhật.');
    }
  };

  const remove = async (item) => {
    if (!confirm(`Xóa yêu cầu #${item.id}?`)) return;
    try {
      await axios.delete(`/api/admin/returns/${item.id}`, { headers });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể xóa.');
    }
  };

  return (
    <section className="admin-ops-page">
      <header className="admin-page-heading">
        <div><small>VẬN HÀNH ĐỔI TRẢ</small><h1>Quản lý hoàn tiền & trả hàng</h1><p>Đọc, cập nhật, duyệt/từ chối và xóa yêu cầu của khách hàng.</p></div>
      </header>
      <div className="admin-kpi-row">{Object.entries(statusLabels).map(([key, label]) => <div key={key}><strong>{summary[key] || 0}</strong><span>{label}</span></div>)}</div>
      <div className="admin-toolbar">
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Mọi trạng thái</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
        <select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Mọi hình thức</option>{Object.entries(typeLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>
      </div>
      {error && <div className="admin-alert">{error}</div>}
      {loading ? <div className="admin-state">Đang tải...</div> : items.length === 0 ? <div className="admin-state">Chưa có yêu cầu phù hợp.</div> : (
        <div className="admin-return-grid">{items.map((item) => <article className="admin-return-card" key={item.id}>
          <header><div><small>#{item.id} · Đơn #{item.order_id}</small><h2>{typeLabels[item.request_type] || item.request_type}</h2></div><b className={`admin-status ${item.status}`}>{statusLabels[item.status]}</b></header>
          <dl><div><dt>Khách hàng</dt><dd>{item.user?.username}<br />{item.user?.email}</dd></div><div><dt>Lý do</dt><dd>{item.reason}</dd></div></dl>
          {item.image && <a href={`/storage/${item.image}`} target="_blank" rel="noreferrer">Xem ảnh minh chứng ↗</a>}
          {item.resolution_note && <p className="resolution-note">Ghi chú: {item.resolution_note}</p>}
          <footer><button onClick={() => { setEditing(item); setForm({ status: item.status, resolution_note: item.resolution_note || '' }); }}>Cập nhật</button><button className="danger" onClick={() => remove(item)}>Xóa</button></footer>
        </article>)}</div>
      )}
      {editing && <div className="admin-dialog-backdrop" onMouseDown={() => setEditing(null)}><div className="admin-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <h2>Xử lý yêu cầu #{editing.id}</h2>
        <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Ghi chú phản hồi<textarea rows="5" value={form.resolution_note} onChange={(event) => setForm({ ...form, resolution_note: event.target.value })} /></label>
        <div><button onClick={() => setEditing(null)}>Hủy</button><button className="primary" onClick={save}>Lưu và thông báo khách</button></div>
      </div></div>}
    </section>
  );
}
