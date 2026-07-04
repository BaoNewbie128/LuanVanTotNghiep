import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/OrderHistory.css';

const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const FALLBACK_IMAGE = '/images/ryosuke.jpg';
const CANCELLABLE_STATUSES = ['pending', 'pending_payment', 'cod_pending'];

const STATUS_META = {
  pending: { label: 'Chờ xác nhận', step: 0 },
  pending_payment: { label: 'Chờ thanh toán', step: 0 },
  cod_pending: { label: 'Chờ xác nhận COD', step: 0 },
  paid: { label: 'Đã xác nhận', step: 1 },
  shipping: { label: 'Đang giao hàng', step: 2 },
  completed: { label: 'Đã giao hàng', step: 3 },
  cancelled: { label: 'Đã hủy', step: -1 },
};

const TRACKING_STEPS = [
  { title: 'Đã đặt hàng', description: 'Đơn hàng đã được ghi nhận' },
  { title: 'Đã xác nhận', description: 'Đơn hàng đã được duyệt' },
  { title: 'Đang giao', description: 'Đơn hàng đang trên đường đến bạn' },
  { title: 'Hoàn thành', description: 'Giao hàng thành công' },
];

const RETURN_TYPE_LABELS = { refund: 'Yêu cầu hoàn tiền', return: 'Trả hàng', exchange: 'Đổi hàng' };
const RETURN_STATUS_LABELS = { pending: 'Đang chờ xử lý', approved: 'Đã được duyệt', rejected: 'Đã bị từ chối', completed: 'Đã hoàn tất' };

const normalizeOrders = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const productName = (item) => {
  const name = [item?.product?.brand, item?.product?.model].filter(Boolean).join(' ');
  return name || 'Sản phẩm';
};

const productImage = (item) => {
  const image = item?.product?.image;
  if (!image) return FALLBACK_IMAGE;
  return image.startsWith('/') || image.startsWith('http') ? image : image.includes('/') ? `/storage/${image}` : `/images/${image}`;
};

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

function OrderTracker({ status }) {
  const currentStep = STATUS_META[status]?.step ?? 0;

  if (status === 'cancelled') {
    return <div className="order-cancelled-note">Đơn hàng này đã được hủy và không tiếp tục xử lý.</div>;
  }

  return (
    <div className="order-tracker" aria-label="Tiến trình đơn hàng">
      {TRACKING_STEPS.map((step, index) => {
        const state = index < currentStep ? 'done' : index === currentStep ? 'current' : '';
        return (
          <div className={`tracking-step ${state}`} key={step.title}>
            <div className="tracking-marker">{index < currentStep ? '✓' : index + 1}</div>
            <div className="tracking-copy">
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReviewModal({ target, token, onClose, onCreated }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const previews = useMemo(() => images.map((file) => ({
    file,
    url: URL.createObjectURL(file),
  })), [images]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const chooseImages = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 5) setError('Bạn chỉ có thể chọn tối đa 5 ảnh.');
    else {
      setError('');
      setImages(files);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) return setError('Vui lòng chọn số sao.');
    if (comment.trim().length < 3) return setError('Nhận xét cần có ít nhất 3 ký tự.');

    const formData = new FormData();
    formData.append('order_id', target.order.id);
    formData.append('product_id', target.item.product_id);
    formData.append('rating', rating);
    formData.append('comment', comment.trim());
    images.forEach((image, index) => {
      formData.append(`images[${index}]`, image.file ?? image);
    });

    try {
      setSubmitting(true);
      setError('');
      await axios.post(`${API_URL}/reviews`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onCreated();
    } catch (err) {
      const validation = err.response?.data?.errors;
      const firstValidationMessage = validation && Object.values(validation).flat()[0];
      setError(firstValidationMessage || err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="review-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="review-modal-close" onClick={onClose} aria-label="Đóng">×</button>
        <div className="review-product-summary">
          <img src={productImage(target.item)} alt={productName(target.item)} />
          <div><small>Đơn hàng #{target.order.id}</small><h2 id="review-title">Đánh giá {productName(target.item)}</h2></div>
        </div>

        <form onSubmit={submit}>
          <label className="review-label">Mức độ hài lòng</label>
          <div className="review-stars" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" className={star <= (hoverRating || rating) ? 'selected' : ''}
                onMouseEnter={() => setHoverRating(star)} onClick={() => setRating(star)} aria-label={`${star} sao`}>★</button>
            ))}
            <span>{rating ? `${rating}/5 sao` : 'Chọn số sao'}</span>
          </div>

          <label className="review-label" htmlFor="review-comment">Nhận xét của bạn</label>
          <textarea id="review-comment" value={comment} maxLength={2000} rows={5}
            onChange={(e) => setComment(e.target.value)} placeholder="Sản phẩm thực tế thế nào? Hãy chia sẻ cảm nhận của bạn..." />
          <div className="review-character-count">{comment.length}/2000</div>

          <label className="review-image-picker" htmlFor="review-images">
            <strong>Thêm ảnh thực tế</strong><span>JPG, PNG hoặc WEBP · tối đa 5 ảnh · 4 MB/ảnh</span>
          </label>
          <input id="review-images" className="review-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseImages} />

          {previews.length > 0 && <div className="review-previews">{previews.map((preview, index) => (
            <div key={`${preview.file.name}-${index}`}><img src={preview.url} alt={`Ảnh đánh giá ${index + 1}`} />
              <button type="button" onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>×</button></div>
          ))}</div>}

          {error && <div className="review-error">{error}</div>}
          <div className="review-modal-actions">
            <button type="button" className="btn-review-cancel" onClick={onClose}>Để sau</button>
            <button type="submit" className="btn-review-submit" disabled={submitting}>{submitting ? 'Đang gửi...' : 'Gửi đánh giá'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReturnRequestModal({ order, token, onClose, onCreated }) {
  const [requestType, setRequestType] = useState('refund');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const preview = useMemo(() => image ? URL.createObjectURL(image) : '', [image]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const submit = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 10) return setError('Vui lòng mô tả lý do ít nhất 10 ký tự.');

    const formData = new FormData();
    formData.append('order_id', order.id);
    formData.append('request_type', requestType);
    formData.append('reason', reason.trim());
    if (image) formData.append('image', image);

    try {
      setSubmitting(true); setError('');
      const response = await axios.post(`${API_URL}/returns`, formData, { headers: { Authorization: `Bearer ${token}` } });
      await onCreated(response.data?.message || 'Đã gửi yêu cầu.');
    } catch (err) {
      const validation = err.response?.data?.errors;
      setError((validation && Object.values(validation).flat()[0]) || err.response?.data?.message || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="return-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="return-request-modal" role="dialog" aria-modal="true" aria-labelledby="return-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="return-modal-close" onClick={onClose} aria-label="Đóng">×</button>
        <span className="return-modal-eyebrow">ĐƠN HÀNG #{order.id}</span>
        <h2 id="return-modal-title">Hoàn tiền / Trả hoặc đổi hàng</h2>
        <p className="return-modal-description">Chọn hình thức phù hợp và cung cấp thông tin rõ ràng để JDM World xử lý nhanh hơn.</p>
        <form onSubmit={submit}>
          <label className="return-field-label">Bạn muốn yêu cầu</label>
          <div className="return-type-options">
            {Object.entries(RETURN_TYPE_LABELS).map(([value, label]) => (
              <label className={requestType === value ? 'selected' : ''} key={value}><input type="radio" name="request_type" value={value} checked={requestType === value} onChange={() => setRequestType(value)} /><span>{value === 'refund' ? '💳' : value === 'return' ? '↩️' : '🔄'}</span><strong>{label}</strong></label>
            ))}
          </div>
          <label className="return-field-label" htmlFor="return-reason">Lý do và tình trạng sản phẩm</label>
          <textarea id="return-reason" rows="5" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: sản phẩm bị lỗi, không đúng mẫu/màu, thiếu phụ kiện..." />
          <div className="return-reason-count">{reason.length}/2000</div>
          <label className="return-image-picker" htmlFor="return-image"><strong>Thêm ảnh minh chứng</strong><span>JPG, PNG hoặc WEBP · tối đa 4 MB</span></label>
          <input id="return-image" className="return-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} />
          {preview && <div className="return-image-preview"><img src={preview} alt="Ảnh minh chứng" /><button type="button" onClick={() => setImage(null)}>×</button></div>}
          {error && <div className="return-form-error">{error}</div>}
          <div className="return-modal-actions"><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={submitting}>{submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}</button></div>
        </form>
      </section>
    </div>
  );
}

function OrderHistoryPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [notice, setNotice] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_URL}/orders?per_page=100`, { headers: { Authorization: `Bearer ${token}` } });
      setOrders(normalizeOrders(response.data));
    } catch (err) {
      setOrders([]);
      setError(err.response?.data?.message || 'Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) navigate('/login');
    else fetchOrders();
  }, [token, navigate, fetchOrders]);

  const matchesFilter = (order, value) => value === 'all'
    || (value === 'pending' ? CANCELLABLE_STATUSES.includes(order.status) : order.status === value);
  const filteredOrders = orders.filter((order) => matchesFilter(order, filter));
  const filters = [
    ['all', 'Tất cả'], ['pending', 'Chờ xác nhận'], ['paid', 'Đã xác nhận'],
    ['shipping', 'Đang giao'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy'],
  ];

  const cancelOrder = async (orderId) => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    try {
      await axios.put(`${API_URL}/orders/${orderId}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await fetchOrders();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Không thể hủy đơn hàng.');
    }
  };

  if (loading) return <div className="order-history-loading">Đang tải đơn hàng...</div>;

  return (
    <main className="order-history-container">
      <header className="order-history-header"><span>TRUNG TÂM ĐƠN HÀNG</span><h1>Theo dõi đơn hàng</h1><p>Xem tiến trình giao hàng và đánh giá những sản phẩm bạn đã nhận.</p></header>

      <div className="filter-buttons" aria-label="Lọc đơn hàng">
        {filters.map(([value, label]) => {
          const count = orders.filter((order) => matchesFilter(order, value)).length;
          return <button type="button" key={value} className={`filter-btn ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>{label} <span>{count}</span></button>;
        })}
      </div>

      {error && <div className="order-page-error">{error}<button type="button" onClick={fetchOrders}>Thử lại</button></div>}
      {notice && <div className="order-page-notice">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
      {!error && filteredOrders.length === 0 && <div className="empty-state"><div>📦</div><p>Chưa có đơn hàng trong mục này.</p><button className="btn-continue-shopping" onClick={() => navigate('/products')}>Tiếp tục mua sắm</button></div>}

      <div className="orders-list">
        {filteredOrders.map((order) => (
          <article key={order.id} className="order-card">
            <div className="order-header">
              <div><span className="order-code">ĐƠN HÀNG #{order.id}</span><p className="order-date">Đặt ngày {new Date(order.created_at).toLocaleString('vi-VN')}</p></div>
              <div className="order-info-right"><span className={`status-badge status-${order.status}`}>{STATUS_META[order.status]?.label || order.status}</span><strong className="order-total">{money(order.total)}</strong></div>
            </div>

            <OrderTracker status={order.status} />

            {order.shipment && (
              <div className="order-shipment-info">
                <div>
                  <span>Đơn vị vận chuyển</span>
                  <strong>{order.shipment.carrier || 'Chưa cập nhật'}</strong>
                </div>
                <div>
                  <span>Mã theo dõi</span>
                  <strong>{order.shipment.tracking_code || 'Chưa cập nhật'}</strong>
                </div>
                {order.shipment.shipped_at && (
                  <div>
                    <span>Bắt đầu giao</span>
                    <strong>{new Date(order.shipment.shipped_at).toLocaleString('vi-VN')}</strong>
                  </div>
                )}
                {order.shipment.tracking_code && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(order.shipment.tracking_code);
                        setNotice('Đã sao chép mã theo dõi.');
                      } catch {
                        setNotice(`Mã theo dõi: ${order.shipment.tracking_code}`);
                      }
                    }}
                  >
                    Sao chép mã
                  </button>
                )}
              </div>
            )}

            <div className="order-products">
              {(order.items || []).map((item) => (
                <div className="order-product" key={item.id}>
                  <img src={productImage(item)} alt={productName(item)} onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }} />
                  <div className="order-product-info"><strong>{productName(item)}</strong><span>{item.product?.color ? `Màu ${item.product.color} · ` : ''}Số lượng: {item.quantity}</span><b>{money(item.price)}</b></div>
                  {item.review ? <div className="reviewed-badge"><span>{'★'.repeat(item.review.rating)}</span> Đã đánh giá</div>
                    : item.can_review && <button type="button" className="btn-review" onClick={() => setReviewTarget({ order, item })}>☆ Viết đánh giá</button>}
                </div>
              ))}
            </div>

            <div className="order-actions">
              <button type="button" className="btn-view-details" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>{expandedOrder === order.id ? 'Ẩn chi tiết' : 'Xem chi tiết thanh toán'}</button>
              {order.can_return && <button type="button" className="btn-return-request" onClick={() => setReturnTarget(order)}>↩ Yêu cầu hoàn tiền / đổi trả</button>}
              {order.return_requests?.[0] && <div className={`return-request-status status-${order.return_requests[0].status}`}><small>{RETURN_TYPE_LABELS[order.return_requests[0].request_type] || 'Yêu cầu đổi trả'}</small><strong>{RETURN_STATUS_LABELS[order.return_requests[0].status] || order.return_requests[0].status}</strong></div>}
              {CANCELLABLE_STATUSES.includes(order.status) && <button type="button" className="btn-cancel" onClick={() => cancelOrder(order.id)}>Hủy đơn</button>}
            </div>

            {expandedOrder === order.id && <div className="order-details">
              <div className="price-row"><span>Tạm tính</span><span>{money(Number(order.total) - Number(order.shipping_fee) + Number(order.discount))}</span></div>
              <div className="price-row"><span>Phí vận chuyển</span><span>{money(order.shipping_fee)}</span></div>
              <div className="price-row discount"><span>Giảm giá</span><span>-{money(order.discount)}</span></div>
              <div className="price-row total"><span>Tổng thanh toán</span><span>{money(order.total)}</span></div>
            </div>}
          </article>
        ))}
      </div>

      {reviewTarget && <ReviewModal target={reviewTarget} token={token} onClose={() => setReviewTarget(null)} onCreated={async () => { setReviewTarget(null); await fetchOrders(); }} />}
      {returnTarget && <ReturnRequestModal order={returnTarget} token={token} onClose={() => setReturnTarget(null)} onCreated={async (message) => { setReturnTarget(null); setNotice(message); await fetchOrders(); }} />}
    </main>
  );
}

export default OrderHistoryPage;
