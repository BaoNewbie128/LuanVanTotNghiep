import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/StaffTicketsPage.css';

const STATUS_LABELS = { pending: 'Chờ xử lý', in_progress: 'Đang xử lý', resolved: 'Đã phản hồi', closed: 'Đã đóng' };

function StaffTicketsPage() {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTicket, setActiveTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const response = await axios.get('/api/staff/tickets', { headers: { Authorization: `Bearer ${token}` }, params: { status: filter, per_page: 50 } });
      setTickets(response.data?.data?.data || []);
      setSummary(response.data?.summary || {});
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải yêu cầu hỗ trợ.');
    } finally { setLoading(false); }
  }, [token, filter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const selectTicket = (ticket) => {
    setActiveTicket(ticket.id);
    setReply(ticket.reply_message || '');
    setNotice(''); setError('');
  };

  const sendReply = async (ticket) => {
    if (reply.trim().length < 5) return setError('Nội dung phản hồi cần ít nhất 5 ký tự.');
    try {
      setSubmitting(true); setError(''); setNotice('');
      const response = await axios.post(`/api/staff/tickets/${ticket.id}/reply`, { reply_message: reply.trim() }, { headers });
      setNotice(response.data?.message || 'Đã lưu phản hồi.');
      await fetchTickets();
      setActiveTicket(ticket.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi phản hồi.');
    } finally { setSubmitting(false); }
  };

  const updateStatus = async (ticket, status) => {
    try {
      await axios.put(`/api/staff/tickets/${ticket.id}/status`, { status }, { headers });
      await fetchTickets();
    } catch (err) { setError(err.response?.data?.message || 'Không thể đổi trạng thái ticket.'); }
  };

  return (
    <section className="staff-tickets-page">
      <header className="staff-tickets-heading"><div><p>Chăm sóc khách hàng</p><h2>Yêu cầu hỗ trợ</h2><span>Đọc và phản hồi trực tiếp cho khách hàng qua website và email.</span></div></header>
      <div className="staff-ticket-summary">
        {Object.entries(STATUS_LABELS).map(([status, label]) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}><strong>{summary[status] || 0}</strong><span>{label}</span></button>)}
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><strong>{Object.values(summary).reduce((sum, value) => sum + Number(value || 0), 0)}</strong><span>Tất cả</span></button>
      </div>
      {error && <div className="staff-ticket-alert error">{error}</div>}{notice && <div className="staff-ticket-alert success">{notice}</div>}
      {loading ? <div className="staff-ticket-state">Đang tải...</div> : tickets.length === 0 ? <div className="staff-ticket-state">Không có yêu cầu trong mục này.</div> : (
        <div className="staff-ticket-list">{tickets.map((ticket) => (
          <article className={`staff-ticket-card status-${ticket.status}`} key={ticket.id}>
            <button type="button" className="staff-ticket-overview" onClick={() => activeTicket === ticket.id ? setActiveTicket(null) : selectTicket(ticket)}>
              <span className="staff-ticket-id">#{ticket.id}</span><div><h3>{ticket.subject}</h3><p>{ticket.name} · {ticket.email}</p></div><time>{new Date(ticket.created_at).toLocaleString('vi-VN')}</time><b>{STATUS_LABELS[ticket.status] || ticket.status}</b>
            </button>
            {activeTicket === ticket.id && <div className="staff-ticket-detail">
              <div className="staff-ticket-question"><small>CÂU HỎI CỦA KHÁCH</small><p>{ticket.message}</p></div>
              <label htmlFor={`reply-${ticket.id}`}>Phản hồi của JDM World</label>
              <textarea id={`reply-${ticket.id}`} rows="6" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Nhập hướng dẫn rõ ràng cho khách hàng..." />
              {ticket.replied_at && <small className="staff-ticket-replied">Phản hồi gần nhất: {new Date(ticket.replied_at).toLocaleString('vi-VN')} {ticket.mail_sent_at ? '· Email đã gửi' : '· Chỉ lưu trên website'}</small>}
              <div className="staff-ticket-actions">
                {ticket.status === 'pending' && <button type="button" className="ticket-progress" onClick={() => updateStatus(ticket, 'in_progress')}>Nhận xử lý</button>}
                {ticket.status !== 'closed' && <button type="button" className="ticket-close" onClick={() => updateStatus(ticket, 'closed')}>Đóng ticket</button>}
                <button type="button" className="ticket-reply" disabled={submitting} onClick={() => sendReply(ticket)}>{submitting ? 'Đang gửi...' : ticket.reply_message ? 'Cập nhật phản hồi' : 'Gửi phản hồi'}</button>
              </div>
            </div>}
          </article>
        ))}</div>
      )}
    </section>
  );
}

export default StaffTicketsPage;
