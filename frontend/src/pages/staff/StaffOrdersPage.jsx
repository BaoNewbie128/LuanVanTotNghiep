import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../../styles/StaffOrdersPage.css';

const filters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'paid', label: 'Đã thanh toán' },
  { key: 'shipping', label: 'Đang giao hàng' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const statusLabels = {
  pending: 'Chờ xử lý',
  pending_payment: 'Chờ thanh toán',
  cod_pending: 'Chờ xác nhận COD',
  paid: 'Đã thanh toán',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const transitionActionLabels = {
  paid: 'Xác nhận thanh toán',
  shipping: 'Chuyển sang giao hàng',
  completed: 'Đánh dấu hoàn thành',
  cancelled: 'Hủy đơn',
};

const defaultShipmentForm = {
  shipmentId: null,
  orderId: null,
  carrier: 'GHN',
  trackingCode: '',
};

const formatCurrency = (value) => Number(value || 0).toLocaleString('vi-VN');

const formatDate = (value) => {
  if (!value) {
    return 'Không có';
  }

  return new Date(value).toLocaleString('vi-VN');
};

const getDeliveryDetails = (order) => ({
  recipient: order.recipient_name || order.user?.username || 'Chưa cập nhật',
  phone: order.shipping_phone || order.user?.phone || 'Chưa cập nhật',
  address: order.shipping_address || order.user?.address || 'Chưa cập nhật',
});

const getTotalQuantity = (order) => (order.items || []).reduce(
  (total, item) => total + Number(item.quantity || 0),
  0,
);

const getGoodsValue = (order) => {
  const valueFromItems = (order.items || []).reduce(
    (total, item) => total + (Number(item.price || 0) * Number(item.quantity || 0)),
    0,
  );

  return valueFromItems || Number(order.total || 0);
};

const isCodOrder = (order) => {
  if (order.payment?.payment_method) {
    return order.payment.payment_method === 'cod';
  }

  // Luồng COD hiện tại không tạo bản ghi payment; MoMo/VNPay luôn có bản ghi.
  return true;
};

const getCodAmount = (order) => {
  if (!isCodOrder(order)) {
    return 0;
  }

  return Math.max(
    0,
    Number(order.total || 0) + Number(order.shipping_fee || 0) - Number(order.discount || 0),
  );
};

const getProductName = (item) => [item.product?.brand, item.product?.model]
  .filter(Boolean)
  .join(' ')
  || `Sản phẩm #${item.product_id}`;

function StaffOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    from: 0,
    to: 0,
    total: 0,
  });
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [shipmentForm, setShipmentForm] = useState(defaultShipmentForm);
  const [shipmentSubmitting, setShipmentSubmitting] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, 400);

    return () => clearTimeout(debounce);
  }, [searchInput]);

  useEffect(() => {
    const fetchOrders = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const params = {
          page: pagination.currentPage,
          per_page: 10,
        };

        if (activeFilter !== 'all') {
          params.status = activeFilter;
        }

        if (searchTerm) {
          params.search = searchTerm;
        }

        const response = await axios.get('/api/staff/orders', {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = response.data?.data;

        setOrders(payload?.data || []);
        setSummary(response.data?.summary || null);
        setPagination({
          currentPage: payload?.current_page || 1,
          lastPage: payload?.last_page || 1,
          from: payload?.from || 0,
          to: payload?.to || 0,
          total: payload?.total || 0,
        });
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || 'Không thể tải danh sách đơn hàng staff.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [activeFilter, searchTerm, pagination.currentPage]);

  const summaryCards = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      { label: 'Tổng đơn', value: summary.total ?? 0 },
      { label: 'Chờ xử lý', value: summary.pending ?? 0 },
      { label: 'Đã thanh toán', value: summary.paid ?? 0 },
      { label: 'Đang giao hàng', value: summary.shipping ?? 0 },
      { label: 'Hoàn thành', value: summary.completed ?? 0 },
      { label: 'Đã hủy', value: summary.cancelled ?? 0 },
    ];
  }, [summary]);

  const handleFilterChange = (filterKey) => {
    setActiveFilter(filterKey);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const goToPage = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  const openShipmentForm = (order) => {
    setShipmentForm({
      shipmentId: order.shipment?.id || null,
      orderId: order.id,
      carrier: order.shipment?.carrier || 'GHN',
      trackingCode: order.shipment?.tracking_code || '',
    });
  };

  const closeShipmentForm = () => {
    setShipmentForm(defaultShipmentForm);
  };

  const copyDeliveryDetails = async (order) => {
    const details = getDeliveryDetails(order);
    const content = [
      `Người nhận: ${details.recipient}`,
      `Số điện thoại: ${details.phone}`,
      `Địa chỉ: ${details.address}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(content);
      setNotice(`Đã sao chép thông tin giao hàng của đơn #${order.id}.`);
      setError('');
    } catch {
      setError('Không thể sao chép tự động. Vui lòng chọn và sao chép thông tin thủ công.');
    }
  };

  const copyGhnOrderDetails = async (order) => {
    const delivery = getDeliveryDetails(order);
    const productLines = (order.items || []).map(
      (item) => `- ${getProductName(item)} x ${Number(item.quantity || 0)}`,
    );
    const content = [
      `Mã đơn riêng: JDM-${order.id}`,
      `Người nhận: ${delivery.recipient}`,
      `Số điện thoại: ${delivery.phone}`,
      `Địa chỉ: ${delivery.address}`,
      'Nội dung hàng hóa:',
      ...productLines,
      `Tổng số lượng: ${getTotalQuantity(order)}`,
      `Tiền thu hộ (COD): ${formatCurrency(getCodAmount(order))} VND`,
      `Tổng giá trị hàng hóa: ${formatCurrency(getGoodsValue(order))} VND`,
      'Khối lượng và kích thước: cân/đo kiện thực tế sau khi đóng gói.',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(content);
      setNotice(`Đã sao chép toàn bộ thông tin nhập GHN của đơn #${order.id}.`);
      setError('');
    } catch {
      setError('Không thể sao chép tự động. Vui lòng chọn và sao chép thông tin thủ công.');
    }
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    const token = localStorage.getItem('token');

    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setActionLoadingId(orderId);
    setError('');

    try {
      const response = await axios.put(
        `/api/staff/orders/${orderId}/status`,
        { status: nextStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedOrder = response.data?.data;

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                ...updatedOrder,
                allowed_transitions: response.data?.allowed_transitions || updatedOrder?.allowed_transitions || [],
              }
            : order
        )
      );

      setSummary((prevSummary) => {
        if (!prevSummary) {
          return prevSummary;
        }

        const previousOrder = orders.find((order) => order.id === orderId);
        const previousStatus = previousOrder?.status;

        if (!previousStatus || previousStatus === nextStatus) {
          return prevSummary;
        }

        const nextSummary = { ...prevSummary };

        if (typeof nextSummary[previousStatus] === 'number') {
          nextSummary[previousStatus] = Math.max(0, nextSummary[previousStatus] - 1);
        }

        if (typeof nextSummary[nextStatus] === 'number') {
          nextSummary[nextStatus] += 1;
        }

        return nextSummary;
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể cập nhật trạng thái đơn hàng.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const submitShipment = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem('token');

    if (!token || !shipmentForm.orderId) {
      setError('Không thể xác thực hoặc thiếu thông tin đơn hàng để tạo vận chuyển.');
      return;
    }

    setShipmentSubmitting(true);
    setError('');

    try {
      const response = shipmentForm.shipmentId
        ? await axios.put(
            `/api/staff/shipments/${shipmentForm.shipmentId}`,
            {
              carrier: shipmentForm.carrier,
              tracking_code: shipmentForm.trackingCode,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          )
        : await axios.post(
            '/api/staff/shipments',
            {
              order_id: shipmentForm.orderId,
              carrier: shipmentForm.carrier,
              tracking_code: shipmentForm.trackingCode,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );

      const updatedShipment = shipmentForm.shipmentId
        ? response.data?.data
        : response.data?.data?.shipment;
      const updatedOrder = shipmentForm.shipmentId
        ? response.data?.data?.order
        : response.data?.data?.order;

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === shipmentForm.orderId
            ? {
                ...order,
                ...(updatedOrder || {}),
                shipment: updatedShipment || updatedOrder?.shipment || order.shipment,
                allowed_transitions: updatedOrder?.allowed_transitions || order.allowed_transitions || [],
              }
            : order
        )
      );

      if (!shipmentForm.shipmentId) setSummary((prevSummary) => {
        if (!prevSummary) {
          return prevSummary;
        }

        const nextSummary = { ...prevSummary };
        if (typeof nextSummary.paid === 'number') {
          nextSummary.paid = Math.max(0, nextSummary.paid - 1);
        }
        if (typeof nextSummary.shipping === 'number') {
          nextSummary.shipping += 1;
        }

        return nextSummary;
      });

      closeShipmentForm();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tạo vận đơn cho đơn hàng này.');
    } finally {
      setShipmentSubmitting(false);
    }
  };

  const markShipmentDelivered = async (order) => {
    const token = localStorage.getItem('token');
    if (!token || !order.shipment?.id) {
      setError('Không tìm thấy vận đơn cần cập nhật.');
      return;
    }

    if (!window.confirm(`Xác nhận đơn #${order.id} đã được giao thành công?`)) return;

    setActionLoadingId(order.id);
    setError('');
    try {
      const response = await axios.put(
        `/api/staff/shipments/${order.shipment.id}`,
        { delivered_at: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const shipment = response.data?.data;

      setOrders((previous) => previous.map((item) => item.id === order.id
        ? {
            ...item,
            status: 'completed',
            shipment,
            allowed_transitions: [],
          }
        : item));
      setSummary((previous) => previous ? {
        ...previous,
        shipping: Math.max(0, Number(previous.shipping || 0) - 1),
        completed: Number(previous.completed || 0) + 1,
      } : previous);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể xác nhận giao hàng thành công.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <section className="staff-orders-page">
      <div className="staff-orders-page__intro">
        <div>
          <h2>Quản lý đơn hàng</h2>
        </div>
        <div className="staff-orders-page__meta">Giai đoạn 1.3</div>
      </div>

      {summaryCards.length > 0 && (
        <div className="staff-orders-summary">
          {summaryCards.map((card) => (
            <article key={card.label} className="staff-orders-summary__card">
              <span className="staff-orders-summary__label">{card.label}</span>
              <p className="staff-orders-summary__value">{card.value}</p>
            </article>
          ))}
        </div>
      )}

      <div className="staff-orders-toolbar">
        <div className="staff-orders-filters">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`staff-orders-filter${activeFilter === filter.key ? ' staff-orders-filter--active' : ''}`}
              onClick={() => handleFilterChange(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="staff-orders-search"
          placeholder="Tìm theo mã đơn, tên khách, email"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      {loading && <div className="staff-orders-empty">Đang tải danh sách đơn hàng...</div>}
      {!loading && error && <div className="staff-orders-feedback">{error}</div>}
      {!loading && notice && (
        <div className="staff-orders-notice">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="staff-orders-empty">Không tìm thấy đơn hàng phù hợp với bộ lọc hiện tại.</div>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          {shipmentForm.orderId && (
            <form className="staff-shipment-form" onSubmit={submitShipment}>
              <div className="staff-shipment-form__header">
                <div>
                  <h3>{shipmentForm.shipmentId ? 'Chỉnh sửa vận đơn' : 'Tạo vận đơn'} cho đơn #{shipmentForm.orderId}</h3>
                  <p>Sao chép chính xác mã vận đơn được cấp trên ứng dụng của đơn vị vận chuyển.</p>
                </div>
                <button type="button" className="staff-shipment-form__close" onClick={closeShipmentForm}>
                  Đóng
                </button>
              </div>

              <div className="staff-shipment-form__grid">
                <label>
                  <span>Đơn vị vận chuyển</span>
                  <select
                    value={shipmentForm.carrier}
                    onChange={(event) =>
                      setShipmentForm((prev) => ({ ...prev, carrier: event.target.value }))
                    }
                  >
                    <option value="GHN">GHN</option>
                    <option value="GHTK">GHTK</option>
                    <option value="VNPost">VNPost</option>
                    <option value="J&T Express">J&T Express</option>
                  </select>
                </label>

                <label>
                  <span>Mã theo dõi</span>
                  <input
                    type="text"
                    value={shipmentForm.trackingCode}
                    onChange={(event) =>
                      setShipmentForm((prev) => ({ ...prev, trackingCode: event.target.value }))
                    }
                    placeholder="Nhập mã trên phiếu gửi, VD: 5ENLKKHD"
                    required
                  />
                  <small>Không tự đặt mã. Mã này phải trùng với mã trên phiếu gửi GHN/GHTK/VNPost/J&amp;T.</small>
                </label>
              </div>

              <div className="staff-shipment-form__actions">
                <button type="button" className="staff-shipment-form__secondary" onClick={closeShipmentForm}>
                  Hủy
                </button>
                <button type="submit" className="staff-shipment-form__primary" disabled={shipmentSubmitting}>
                  {shipmentSubmitting
                    ? 'Đang lưu vận đơn...'
                    : shipmentForm.shipmentId ? 'Lưu thay đổi' : 'Xác nhận tạo vận đơn'}
                </button>
              </div>
            </form>
          )}

          <div className="staff-orders-list">
            {orders.map((order) => (
              <article key={order.id} className="staff-order-card">
                <div className="staff-order-card__header">
                  <div className="staff-order-card__identity">
                    <h3>Đơn hàng #{order.id}</h3>
                    <p>Tạo lúc: {formatDate(order.created_at)}</p>
                  </div>

                  <div className="staff-order-card__meta">
                    <span className={`staff-order-status staff-order-status--${order.status}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                    <p>Tổng thanh toán: {formatCurrency(order.total)} VND</p>
                  </div>
                </div>

                <div className="staff-order-card__body">
                  <div className="staff-order-customer">
                    <h4>Khách hàng</h4>
                    <p>{order.recipient_name || order.user?.username || 'Chưa cập nhật'}</p>
                    <p>{order.user?.email || 'N/A'}</p>
                    <p><strong>SĐT:</strong> {order.shipping_phone || order.user?.phone || 'Chưa cập nhật'}</p>
                    <p className="staff-order-customer__address">
                      <strong>Địa chỉ:</strong> {order.shipping_address || order.user?.address || 'Chưa cập nhật'}
                    </p>
                    <button
                      type="button"
                      className="staff-order-copy-address"
                      onClick={() => copyDeliveryDetails(order)}
                    >
                      Sao chép thông tin cho GHN
                    </button>
                  </div>

                  <div className="staff-order-items">
                    <h4>Sản phẩm</h4>
                    <div className="staff-order-products-table" role="table" aria-label={`Sản phẩm của đơn ${order.id}`}>
                      <div className="staff-order-products-table__row staff-order-products-table__head" role="row">
                        <span>Hãng / mẫu xe</span>
                        <span>Phân loại</span>
                        <span>SL</span>
                        <span>Đơn giá</span>
                        <span>Thành tiền</span>
                      </div>
                      {(order.items || []).map((item) => (
                        <div className="staff-order-products-table__row" role="row" key={item.id}>
                          <strong>{getProductName(item)}</strong>
                          <span>{[item.product?.scale, item.product?.color].filter(Boolean).join(' · ') || '—'}</span>
                          <span>{Number(item.quantity || 0)}</span>
                          <span>{formatCurrency(item.price)}đ</span>
                          <strong>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}đ</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 style={{ marginTop: 0, marginBottom: 12 }}>Vận chuyển</h4>
                    <p className="staff-order-shipment">
                      {order.shipment?.tracking_code
                        ? `Mã tracking: ${order.shipment.tracking_code}`
                        : 'Chưa gắn mã tracking'}
                    </p>
                    <p className="staff-order-shipment">
                      Đơn vị vận chuyển: {order.shipment?.carrier || 'Chưa chọn'}
                    </p>
                    {!order.shipment && ['paid', 'cod_pending'].includes(order.status) && (
                      <button
                        type="button"
                        className="staff-order-shipment-btn"
                        onClick={() => openShipmentForm(order)}
                      >
                        Tạo vận đơn / gắn tracking
                      </button>
                    )}
                    {order.shipment && !order.shipment.delivered_at && order.status === 'shipping' && (
                      <div className="staff-order-shipment-actions">
                        <button
                          type="button"
                          className="staff-order-shipment-btn"
                          onClick={() => openShipmentForm(order)}
                        >
                          Sửa vận đơn
                        </button>
                        <button
                          type="button"
                          className="staff-order-delivered-btn"
                          onClick={() => markShipmentDelivered(order)}
                          disabled={actionLoadingId === order.id}
                        >
                          {actionLoadingId === order.id ? 'Đang cập nhật...' : 'Xác nhận đã giao'}
                        </button>
                      </div>
                    )}
                    {order.shipment?.shipped_at && (
                      <p className="staff-order-shipment">Bắt đầu giao: {formatDate(order.shipment.shipped_at)}</p>
                    )}
                    {order.shipment?.delivered_at && (
                      <p className="staff-order-shipment">Đã giao: {formatDate(order.shipment.delivered_at)}</p>
                    )}
                  </div>
                </div>

                <section className="staff-order-ghn-info" aria-label={`Thông tin nhập GHN cho đơn ${order.id}`}>
                  <div className="staff-order-ghn-info__header">
                    <div>
                      <h4>Thông tin nhập đơn GHN</h4>
                      <p>Các số tiền được tính trực tiếp từ đơn hàng và chi tiết sản phẩm.</p>
                    </div>
                    <button type="button" onClick={() => copyGhnOrderDetails(order)}>
                      Sao chép toàn bộ thông tin GHN
                    </button>
                  </div>

                  <div className="staff-order-ghn-info__grid">
                    <div><span>Mã đơn riêng khách hàng</span><strong>JDM-{order.id}</strong></div>
                    <div><span>Tổng số lượng</span><strong>{getTotalQuantity(order)} sản phẩm</strong></div>
                    <div><span>Tiền thu hộ (COD)</span><strong>{formatCurrency(getCodAmount(order))} VND</strong></div>
                    <div><span>Tổng giá trị hàng hóa</span><strong>{formatCurrency(getGoodsValue(order))} VND</strong></div>
                    <div className="staff-order-ghn-info__measure">
                      <span>Khối lượng (gram)</span>
                      <strong>Cân kiện sau đóng gói</strong>
                    </div>
                    <div className="staff-order-ghn-info__measure">
                      <span>Dài × Rộng × Cao (cm)</span>
                      <strong>Đo kích thước kiện thực tế</strong>
                    </div>
                  </div>
                  <p className="staff-order-ghn-info__note">
                    Không dùng mặc định 500g hoặc 10 × 10 × 10 nếu kiện thực tế khác, vì GHN dùng các số này để tính cước và khối lượng quy đổi.
                  </p>
                </section>

                <div className="staff-order-card__footer">
                  <div className="staff-order-card__totals">
                    <span>
                      Phí ship: <strong>{formatCurrency(order.shipping_fee)} VND</strong>
                    </span>
                    <span>
                      Giảm giá: <strong>{formatCurrency(order.discount)} VND</strong>
                    </span>
                    <span>
                      Tổng số lượng: <strong>{getTotalQuantity(order)}</strong>
                    </span>
                  </div>

                  <div className="staff-order-card__actions">
                    {(order.allowed_transitions || [])
                      .filter((nextStatus) => !(nextStatus === 'completed' && order.shipment))
                      .map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        className={`staff-order-action-btn staff-order-action-btn--${nextStatus}`}
                        onClick={() => updateOrderStatus(order.id, nextStatus)}
                        disabled={actionLoadingId === order.id}
                      >
                        {actionLoadingId === order.id ? 'Đang cập nhật...' : (transitionActionLabels[nextStatus] || `Chuyển ${nextStatus}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="staff-orders-pagination">
            <span>
              Hiển thị {pagination.from} - {pagination.to} / {pagination.total} đơn hàng
            </span>

            <div className="staff-orders-pagination__buttons">
              <button
                type="button"
                onClick={() => goToPage(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={() => goToPage(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.lastPage}
              >
                Trang sau
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default StaffOrdersPage;
