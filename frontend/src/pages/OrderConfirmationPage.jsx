import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/OrderConfirmation.css';

function OrderConfirmationPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  const statusLabels = {
    pending: 'Chờ xử lý',
    pending_payment: 'Chờ thanh toán',
    cod_pending: 'Chờ xác nhận COD',
    paid: 'Đã thanh toán',
    shipping: 'Đang giao hàng',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };

  const formatPrice = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`;

  const getProductImage = (item) => {
    const image = item?.product?.image || item?.image;
    if (!image) return '/images/ryosuke.jpg';
    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) return image;
    return image.includes('/') ? `/storage/${image}` : `/images/${image}`;
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchOrder = async () => {
      try {
        const response = await axios.get(
          `/api/orders/${orderId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setOrder(response.data.data);
        setError('');
      } catch (err) {
        console.error('Không thể tải đơn hàng:', err);
        const apiMessage = err.response?.data?.message;
        setError(apiMessage === 'Order not found' ? 'Không tìm thấy đơn hàng.' : 'Không thể tải thông tin đơn hàng.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, token, navigate]);

  if (loading) {
    return <div className="confirmation-loading">Đang tải thông tin đơn hàng...</div>;
  }

  if (!order) {
    return (
      <div className="confirmation-error">
        <h2>{error || 'Không tìm thấy đơn hàng.'}</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>Quay lại lịch sử đơn hàng</button>
      </div>
    );
  }

  return (
    <div className="confirmation-container">
      <div className="confirmation-card">
        <div className="confirmation-header success">
          <div className="checkmark-icon">✓</div>
          <h1>Đặt Hàng Thành Công!</h1>
          <p>Cảm ơn bạn đã mua sắm tại JDM WORLD</p>
        </div>

        <div className="order-info">
          <div className="info-row">
            <span className="label">Mã đơn hàng:</span>
            <span className="value">#{order.id}</span>
          </div>
          <div className="info-row">
            <span className="label">Ngày đặt hàng:</span>
            <span className="value">{new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
          </div>
          <div className="info-row">
            <span className="label">Trạng thái:</span>
            <span className={`status status-${order.status}`}>{statusLabels[order.status] || order.status}</span>
          </div>
        </div>

        <div className="items-summary">
          <h3>Sản Phẩm Đã Đặt</h3>
          <div className="items-list">
            {order.items?.map(item => {
              const product = item.product || item;
              return (
              <div key={item.id} className="item-row">
                <img
                  src={getProductImage(item)}
                  alt={`${product.brand || ''} ${product.model || 'Sản phẩm'}`.trim()}
                  onError={(event) => { event.currentTarget.src = '/images/ryosuke.jpg'; }}
                />
                <div className="item-info">
                  <h4>{product.brand} {product.model}</h4>
                  {product.color && <p className="color">Màu: {product.color}</p>}
                </div>
                <div className="item-qty">x{item.quantity}</div>
                <div className="item-total">
                  {formatPrice(Number(item.price) * Number(item.quantity))}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="price-breakdown">
          <div className="price-row">
            <span>Tạm tính:</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          <div className="price-row">
            <span>Phí vận chuyển:</span>
            <span>{formatPrice(order.shipping_fee)}</span>
          </div>
          {order.discount > 0 && (
            <div className="price-row">
              <span>Giảm giá:</span>
              <span className="discount">-{formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="price-row total">
            <span>Tổng thanh toán:</span>
            <span>{formatPrice(Number(order.total) + Number(order.shipping_fee || 0) - Number(order.discount || 0))}</span>
          </div>
        </div>

        <div className="delivery-info">
          <h3>Thông Tin Nhận Hàng</h3>
          <p><strong>Người nhận:</strong> {order.recipient_name || order.user?.username || 'Chưa cập nhật'}</p>
          <p><strong>Số điện thoại:</strong> {order.shipping_phone || order.user?.phone || 'Chưa cập nhật'}</p>
          <p><strong>Địa chỉ:</strong> {order.shipping_address || order.user?.address || 'Chưa cập nhật'}</p>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => navigate('/orders')}>
            Xem lịch sử đơn hàng
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/products')}>
            Tiếp tục mua sắm
          </button>
        </div>

        <div className="confirmation-note">
          <p>📋 Bạn có thể theo dõi trạng thái đơn hàng trong mục Lịch sử đơn hàng.</p>
          <p>📦 Bạn sẽ nhận được thông báo khi đơn hàng bắt đầu được giao.</p>
        </div>
      </div>
    </div>
  );
}

export default OrderConfirmationPage;
