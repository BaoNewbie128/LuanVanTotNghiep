import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './AdminOperations.css';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
const statusLabels = { pending: 'Chờ xử lý', pending_payment: 'Chờ thanh toán', cod_pending: 'Chờ xác nhận COD', paid: 'Đã thanh toán', shipping: 'Đang giao hàng', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const reportTypeLabels = { orders: 'Đơn hàng', returns: 'Đổi trả', payments: 'Thanh toán', products: 'Sản phẩm', customers: 'Khách hàng' };

export default function AdminReportsPage() {
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [kpi, setKpi] = useState(null);
  const [chart, setChart] = useState([]);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [exportType, setExportType] = useState('orders');
  const [dates, setDates] = useState({ start_date: '', end_date: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get('/api/admin/reports/kpis', { headers }),
      axios.get('/api/admin/dashboard/revenue', { headers, params: { period } }),
      axios.get('/api/admin/dashboard/stats', { headers }),
    ]).then(([kpiResponse, chartResponse, statsResponse]) => {
      setKpi(kpiResponse.data.data);
      setChart(chartResponse.data.data || []);
      setStats(statsResponse.data.data);
    }).catch((requestError) => setError(requestError.response?.data?.message || 'Không thể tải báo cáo.'));
  }, [headers, period]);

  const exportExcel = async () => {
    try {
      const response = await axios.get('/api/admin/reports/export', { headers, responseType: 'blob', params: { type: exportType, ...dates } });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bao-cao-${exportType}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Không thể xuất Excel.');
    }
  };

  const max = Math.max(...chart.map((item) => Number(item.revenue)), 1);

  return <section className="admin-ops-page">
    <header className="admin-page-heading"><div><small>PHÂN TÍCH KINH DOANH</small><h1>Báo cáo hệ thống & KPI</h1><p>Phân tích hiệu suất kinh doanh và xuất dữ liệu Excel.</p></div></header>
    {error && <div className="admin-alert">{error}</div>}
    {kpi && <div className="admin-kpi-grid">{[
      ['Doanh thu', money(kpi.revenue)], ['Giá trị đơn trung bình', money(kpi.average_order_value)], ['Hoàn tất', `${kpi.completion_rate}%`], ['Hủy đơn', `${kpi.cancellation_rate}%`], ['Thanh toán thành công', `${kpi.payment_success_rate}%`], ['Tỷ lệ đổi trả', `${kpi.return_rate}%`], ['Giá trị tồn kho', money(kpi.inventory_value)], ['Đổi trả chờ xử lý', kpi.pending_returns],
    ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}
    <div className="admin-report-grid">
      <article className="admin-panel"><header><div><h2>Biểu đồ doanh thu</h2><p>Theo chu kỳ</p></div><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="daily">30 ngày</option><option value="weekly">12 tuần</option><option value="monthly">12 tháng</option></select></header><div className="admin-bar-chart">{chart.map((item, index) => <div key={index}><span>{Number(item.revenue || 0).toLocaleString('vi-VN', { notation: 'compact' })}</span><i style={{ height: `${Math.max(Number(item.revenue) / max * 190, 5)}px` }} /><small>{item.date || `T${item.week || item.month}`}</small></div>)}</div></article>
      <article className="admin-panel"><h2>Phân bổ trạng thái đơn</h2><div className="admin-status-chart">{Object.entries(stats?.order_stats || {}).map(([status, count]) => <div key={status}><span>{statusLabels[status] || status}</span><b>{count}</b><i><em style={{ width: `${Number(count) / Math.max(stats.total_orders, 1) * 100}%` }} /></i></div>)}</div></article>
    </div>
    <article className="admin-panel admin-export-panel"><div><h2>Xuất báo cáo Excel</h2><p>Tệp XLSX tương thích Microsoft Excel.</p></div><select value={exportType} onChange={(event) => setExportType(event.target.value)}>{Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="date" aria-label="Ngày bắt đầu" value={dates.start_date} onChange={(event) => setDates({ ...dates, start_date: event.target.value })} /><input type="date" aria-label="Ngày kết thúc" value={dates.end_date} onChange={(event) => setDates({ ...dates, end_date: event.target.value })} /><button onClick={exportExcel}>Xuất Excel</button></article>
  </section>;
}
