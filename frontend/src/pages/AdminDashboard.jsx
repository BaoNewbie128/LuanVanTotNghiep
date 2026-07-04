import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminDashboard.css';

const api = import.meta.env.VITE_API_BASE_URL || '/api';

const dashboardCardStyle = {
  background: 'var(--admin-card)',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  border: '1px solid var(--admin-border)',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const formatDateLabel = (item, period) => {
  if (period === 'daily') {
    return new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  if (period === 'weekly') {
    return `T${item.week}/${item.year}`;
  }

  return `T${item.month}/${item.year}`;
};

const normalizeTopProductName = (product) => `${product.brand || ''} ${product.model || ''}`.trim();

const orderStatusLabels = {
  pending: 'Chờ xử lý',
  pending_payment: 'Chờ thanh toán',
  cod_pending: 'Chờ xác nhận COD',
  paid: 'Đã thanh toán',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

function MiniBarChart({ data, period }) {
  const maxValue = Math.max(...data.map((item) => Number(item.revenue || 0)), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, minHeight: 240, marginTop: 16 }}>
      {data.map((item, index) => {
        const revenue = Number(item.revenue || 0);
        const height = Math.max((revenue / maxValue) * 180, 8);

        return (
          <div key={`${period}-${index}`} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{formatCompactCurrency(revenue)}</div>
            <div
              title={`${formatDateLabel(item, period)}: ${formatCurrency(revenue)}`}
              style={{
                height,
                borderRadius: '12px 12px 4px 4px',
                background: 'linear-gradient(180deg, #2563eb 0%, #60a5fa 100%)',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.18)',
              }}
            />
            <div style={{ fontSize: 12, color: '#374151', marginTop: 8 }}>{formatDateLabel(item, period)}</div>
          </div>
        );
      })}
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [stats, setStats] = useState(null);
  const [revenueStats, setRevenueStats] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [staleInventory, setStaleInventory] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  const token = localStorage.getItem('token');

  const exportOrders = async () => {
    setError('');

    try {
      const response = await axios.get(`${api}/admin/reports/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] || '';
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'admin-orders.xlsx';
      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể xuất báo cáo đơn hàng.');
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const loadDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const [statsResponse, revenueResponse, topResponse, staleResponse, lowStockResponse] = await Promise.all([
          axios.get(`${api}/admin/dashboard/stats`, { headers }),
          axios.get(`${api}/admin/dashboard/revenue`, { headers, params: { period } }),
          axios.get(`${api}/admin/dashboard/top-products`, { headers }),
          axios.get(`${api}/admin/dashboard/stale-inventory`, { headers }),
          axios.get(`${api}/admin/dashboard/low-stock`, { headers }),
        ]);

        setStats(statsResponse.data?.data || null);
        setRevenueStats(revenueResponse.data?.data || []);
        setTopProducts(topResponse.data?.data || []);
        setStaleInventory(staleResponse.data?.data || []);
        setLowStockProducts(lowStockResponse.data?.data || []);
      } catch (requestError) {
        const redirectTo = requestError.response?.data?.redirect_to;

        if (requestError.response?.status === 403 && redirectTo) {
          navigate(redirectTo, { replace: true });
          return;
        }

        setError(requestError.response?.data?.message || 'Không thể tải dữ liệu tổng quan.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate, period, token]);

  const statCards = useMemo(() => {
    if (!stats) return [];

    return [
      { label: 'Doanh thu', value: formatCurrency(stats.total_revenue), accent: '#16a34a' },
      { label: 'Tổng đơn hàng', value: Number(stats.total_orders || 0).toLocaleString('vi-VN'), accent: '#2563eb' },
      { label: 'Khách hàng mới', value: Number(stats.total_customers || 0).toLocaleString('vi-VN'), accent: '#7c3aed' },
      {
        label: 'Đơn hoàn tất / đã thanh toán',
        value: `${Number(stats.order_stats?.completed || 0).toLocaleString('vi-VN')} / ${Number(stats.order_stats?.paid || 0).toLocaleString('vi-VN')}`,
        accent: '#ea580c',
      },
    ];
  }, [stats]);

  return (
    <div className="admin-dashboard-page" style={{ maxWidth: 1280, margin: '32px auto', padding: '0 16px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ marginBottom: 12 }}>Trang quản trị</h1>
        <button
          type="button"
          onClick={exportOrders}
          style={{ border: 0, borderRadius: 10, padding: '10px 14px', background: '#111827', color: '#fff', cursor: 'pointer', fontWeight: 600 , backgroundColor:'green' }}
        >
          Xuất báo cáo Excel
        </button>
      </div>
      <p style={{ marginBottom: 24, color: '#555' }}>
        Theo dõi doanh thu, số đơn, xu hướng bán hàng, top sản phẩm bán chạy và các mặt hàng tồn kho lâu ngày.
      </p>

      {error ? (
        <div style={{ ...dashboardCardStyle, marginBottom: 20, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={dashboardCardStyle}>Đang tải dữ liệu tổng quan...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            {statCards.map((item) => (
              <div key={item.label} style={dashboardCardStyle}>
                <div style={{ width: 42, height: 6, borderRadius: 999, background: item.accent, marginBottom: 14 }} />
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: 20, marginBottom: 24 }}>
            <div style={dashboardCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Biểu đồ doanh thu</h2>
                  <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Dữ liệu lấy từ các đơn đã ghi nhận doanh thu theo chu kỳ đã chọn.</p>
                </div>

                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: '10px 12px', background: '#fff' }}
                >
                  <option value="daily">30 ngày</option>
                  <option value="weekly">12 tuần</option>
                  <option value="monthly">12 tháng</option>
                </select>
              </div>

              {revenueStats.length ? (
                <MiniBarChart data={revenueStats} period={period} />
              ) : (
                <p style={{ marginTop: 20, color: '#6b7280' }}>Chưa có dữ liệu doanh thu cho khoảng thời gian này.</p>
              )}
            </div>

            <div style={dashboardCardStyle}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Trạng thái đơn hàng</h2>
              <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                {Object.entries(stats?.order_stats || {}).map(([status, value]) => (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#374151' }}>
                      <span>{orderStatusLabels[status] || status}</span>
                      <strong>{Number(value || 0).toLocaleString('vi-VN')}</strong>
                    </div>
                    <div style={{ height: 8, background: '#e5e7eb', borderRadius: 999 }}>
                      <div
                        style={{
                          width: `${Math.min(((Number(value || 0) / Math.max(Number(stats?.total_orders || 1), 1)) * 100), 100)}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: '#2563eb',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div style={dashboardCardStyle}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Sản phẩm bán chạy nhất</h2>
              <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                {topProducts.length ? topProducts.map((product, index) => (
                  <div key={product.id} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#dbeafe', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                      #{index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{normalizeTopProductName(product)}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{product.color} • {product.scale}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{Number(product.total_quantity_sold || 0).toLocaleString('vi-VN')} sp</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{formatCurrency(product.total_revenue)}</div>
                    </div>
                  </div>
                )) : <p style={{ color: '#6b7280', margin: 0 }}>Chưa có sản phẩm bán chạy.</p>}
              </div>
            </div>

            <div style={dashboardCardStyle}>
              <h2 style={{ marginTop: 0, fontSize: 22 }}>Tồn kho lâu ngày chưa bán</h2>
              <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                {staleInventory.length ? staleInventory.map((product) => (
                  <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{normalizeTopProductName(product)}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>
                        {product.color} • {Number(product.total_quantity_sold || 0).toLocaleString('vi-VN')} đã bán
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{Number(product.stock || 0).toLocaleString('vi-VN')} tồn</div>
                      <div style={{ color: '#b45309', fontSize: 13 }}>{Number(product.idle_days || 0).toLocaleString('vi-VN')} ngày chưa bán</div>
                    </div>
                  </div>
                )) : <p style={{ color: '#6b7280', margin: 0 }}>Không có dữ liệu tồn kho chậm luân chuyển.</p>}
              </div>
            </div>
          </div>

          <div style={{ ...dashboardCardStyle, marginBottom: 24 }}>
            <h2 style={{ marginTop: 0, fontSize: 22 }}>Sản phẩm sắp hết hàng</h2>
            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '10px 12px' }}>Sản phẩm</th>
                    <th style={{ padding: '10px 12px' }}>Màu</th>
                    <th style={{ padding: '10px 12px' }}>Tỉ lệ</th>
                    <th style={{ padding: '10px 12px' }}>Tồn kho</th>
                    <th style={{ padding: '10px 12px' }}>Ngưỡng cảnh báo</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.length ? lowStockProducts.map((product) => (
                    <tr key={product.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>{normalizeTopProductName(product)}</td>
                      <td style={{ padding: '12px' }}>{product.color}</td>
                      <td style={{ padding: '12px' }}>{product.scale}</td>
                      <td style={{ padding: '12px', color: '#b91c1c', fontWeight: 700 }}>{product.stock}</td>
                      <td style={{ padding: '12px' }}>{product.low_stock_threshold}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" style={{ padding: '12px', color: '#6b7280' }}>Không có sản phẩm nào dưới ngưỡng cảnh báo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}


    </div>
  );
}

export default AdminDashboard;
