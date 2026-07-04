import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/CheckoutPage.css';

function CheckoutPage() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    payment_method: 'cod'
  });
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [processing, setProcessing] = useState(false);

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userPhone = user?.phone || '';
  const userAddress = user?.address || '';

  const translateApiMessage = (message, fallback) => {
    const translations = {
      'Coupon not found': 'Không tìm thấy mã giảm giá.',
      'Coupon has expired': 'Mã giảm giá đã hết hạn.',
      'Invalid coupon code': 'Mã giảm giá không hợp lệ.',
      'Cart is empty': 'Giỏ hàng đang trống.',
      Unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    };

    return translations[message] || message || fallback;
  };

  const formatPrice = (price) => new Intl.NumberFormat('vi-VN').format(price || 0);

  const getProductImage = (product) => {
    if (!product?.image) return '/images/ryosuke.jpg';

    return product.image.startsWith('/') || product.image.startsWith('http')
      ? product.image
      : product.image.includes('/') ? `/storage/${product.image}` : `/images/${product.image}`;
  };

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/cart', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCartItems(response.data.data?.items || []);
      setFormData(prev => ({
        ...prev,
        phone: userPhone,
        address: userAddress
      }));
    } catch (err) {
      console.error('Không thể tải giỏ hàng:', err);
    } finally {
      setLoading(false);
    }
  }, [token, userAddress, userPhone]);

  // Fetch cart items
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchCart();
  }, [fetchCart, token, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Vui lòng nhập mã giảm giá.');
      return;
    }

    try {
      setCouponError('');
      const { subtotal } = calculateTotal();
      const response = await axios.post(
        '/api/coupons/validate',
        { code: couponCode, total: subtotal },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCouponDiscount(Number(response.data.discount || 0));
      alert('Áp dụng mã giảm giá thành công!');
    } catch (err) {
      setCouponError(translateApiMessage(err.response?.data?.message, 'Mã giảm giá không hợp lệ.'));
      setCouponDiscount(0);
    }
  };

  const calculateTotal = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + ((item.product?.price || 0) * item.quantity), 0);
    const shippingFee = 30000; // VND
    return {
      subtotal,
      shippingFee,
      discount: couponDiscount,
      total: subtotal + shippingFee - couponDiscount
    };
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.phone || !formData.address) {
      alert('Vui lòng nhập đầy đủ số điện thoại và địa chỉ nhận hàng.');
      return;
    }

    if (cartItems.length === 0) {
      alert('Giỏ hàng đang trống.');
      return;
    }

    try {
      setProcessing(true);
      const { shippingFee, discount, total } = calculateTotal();

      const orderData = {
        phone: formData.phone,
        address: formData.address,
        payment_method: formData.payment_method,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product?.price || 0
        })),
        coupon_code: couponCode || null,
        shipping_fee: shippingFee,
        discount: discount,
        total: total
      };

      const response = await axios.post(
        '/api/orders',
        orderData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const orderId = response.data.data?.order_id || response.data.data?.id;

      // Handle payment based on method
      if (formData.payment_method === 'cod') {
        // COD - just complete order
        navigate(`/order-confirmation/${orderId}`);
      } else if (formData.payment_method === 'momo') {
        const paymentResponse = await axios.post(
          '/api/payments/momo',
          { order_id: orderId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const momoUrl = paymentResponse.data?.payment_url;
        if (!momoUrl) {
          throw new Error('Không nhận được đường dẫn thanh toán MoMo.');
        }
        window.location.assign(momoUrl);
      } else if (formData.payment_method === 'vnpay') {
        const paymentResponse = await axios.post(
          '/api/payments/vnpay',
          { order_id: orderId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const vnpayUrl = paymentResponse.data?.payment_url;
        if (!vnpayUrl) {
          throw new Error('Không nhận được đường dẫn thanh toán VNPay.');
        }
        window.location.assign(vnpayUrl);
      }
    } catch (err) {
      alert(translateApiMessage(err.response?.data?.message || err.message, 'Không thể tạo đơn hàng. Vui lòng thử lại.'));
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="checkout-loading">Đang tải thông tin thanh toán...</div>;
  if (cartItems.length === 0 && !loading) {
    return (
      <div className="checkout-empty">
        <h2>Giỏ hàng của bạn đang trống</h2>
        <button onClick={() => navigate('/products')}>Tiếp tục mua sắm</button>
      </div>
    );
  }

  const { subtotal, shippingFee, discount, total } = calculateTotal();

  return (
    <div className="checkout-container">
      <div className="checkout-content">
        <div className="checkout-main">
          <h1>Thanh Toán</h1>

          {/* Order Summary */}
          <div className="order-summary">
            <h2>Tóm Tắt Đơn Hàng</h2>
            <div className="summary-items">
              {cartItems.map(item => (
                <div key={item.id} className="summary-item">
                  <img
                    src={getProductImage(item.product)}
                    alt={item.product?.model || 'Sản phẩm'}
                    onError={(e) => { e.target.src = '/images/ryosuke.jpg'; }}
                  />
                  <div className="item-details">
                    <h4>{item.product?.brand} {item.product?.model}</h4>
                    <p className="item-color">{item.product?.color}</p>
                  </div>
                  <div className="item-qty">x{item.quantity}</div>
                  <div className="item-price">
                    {formatPrice((item.product?.price || 0) * item.quantity)} VNĐ
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coupon Section */}
          <div className="coupon-section">
            <h3>Bạn có mã giảm giá?</h3>
            <div className="coupon-input-group">
              <input
                type="text"
                placeholder="Nhập mã giảm giá"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
              />
              <button type="button" onClick={applyCoupon} className="btn-apply-coupon">
                Áp dụng
              </button>
            </div>
            {couponError && <p className="coupon-error">{couponError}</p>}
            {couponDiscount > 0 && (
              <p className="coupon-success">Đã áp dụng mã giảm giá: -{couponDiscount.toLocaleString('vi-VN')} VNĐ</p>
            )}
          </div>

          {/* Pricing Summary */}
          <div className="pricing-summary">
            <div className="price-row">
              <span>Tạm tính:</span>
              <span>{formatPrice(subtotal)} VNĐ</span>
            </div>
            <div className="price-row">
              <span>Phí vận chuyển:</span>
              <span>{formatPrice(shippingFee)} VNĐ</span>
            </div>
            {discount > 0 && (
              <div className="price-row discount">
                <span>Giảm giá:</span>
                <span>-{formatPrice(discount)} VNĐ</span>
              </div>
            )}
            <div className="price-row total">
              <span>Tổng thanh toán:</span>
              <span>{formatPrice(total)} VNĐ</span>
            </div>
          </div>
        </div>

        {/* Checkout Form */}
        <div className="checkout-form">
          <h2>Thông Tin Nhận Hàng</h2>
          <form onSubmit={handleCheckout}>
            <div className="form-group">
              <label>Số điện thoại *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Nhập số điện thoại người nhận"
                required
                pattern="[0-9]+"
              />
            </div>

            <div className="form-group">
              <label>Địa chỉ nhận hàng *</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Nhập địa chỉ giao hàng đầy đủ"
                required
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Phương thức thanh toán *</label>
              <div className="payment-methods">
                <label className="payment-option">
                  <input
                    type="radio"
                    name="payment_method"
                    value="cod"
                    checked={formData.payment_method === 'cod'}
                    onChange={handleInputChange}
                  />
                  <span>Thanh toán khi nhận hàng (COD)</span>
                </label>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="payment_method"
                    value="momo"
                    checked={formData.payment_method === 'momo'}
                    onChange={handleInputChange}
                  />
                  <span>Ví điện tử MoMo</span>
                </label>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="payment_method"
                    value="vnpay"
                    checked={formData.payment_method === 'vnpay'}
                    onChange={handleInputChange}
                  />
                  <span>Thanh toán trực tuyến qua VNPay</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn-place-order"
              disabled={processing}
            >
              {processing ? 'Đang xử lý...' : 'Đặt hàng'}
            </button>
          </form>

          <button
            type="button"
            className="btn-continue-shopping"
            onClick={() => navigate('/products')}
          >
            Tiếp tục mua sắm
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
