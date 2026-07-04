import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import './CartPage.css';

function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/cart', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCartItems(response.data.data?.items || []);
      setError('');
    } catch (err) {
      setError('Không thể tải giỏ hàng');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchCart();
    } else {
      setLoading(false);
      setError('Vui lòng đăng nhập để xem giỏ hàng');
    }
  }, [token, fetchCart]);

  const updateQuantity = async (cartItemId, newQuantity) => {
    if (newQuantity < 1) {
      removeItem(cartItemId);
      return;
    }

    try {
      setUpdating(cartItemId);
      await axios.put(
        `/api/cart/update/${cartItemId}`,
        { quantity: newQuantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchCart();
    } catch (err) {
      setError('Không thể cập nhật số lượng');
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (cartItemId) => {
    try {
      setUpdating(cartItemId);
      await axios.delete(
        `/api/cart/remove/${cartItemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchCart();
    } catch (err) {
      setError('Không thể xóa sản phẩm');
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const calculateShipping = () => {
    return cartItems.length > 0 ? 30000 : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping();
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      setError('Giỏ hàng trống');
      return;
    }
    navigate('/checkout');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price);
  };

  if (loading) {
    return (
      <div className="cart-page">
        <div className="container">
          <LoadingSpinner text="Đang tải giỏ hàng..." />
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <h1 className="page-title">
          <span className="title-icon">🛒</span>
          Giỏ Hàng Của Bạn
        </h1>
        
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <div className="empty-icon">🛒</div>
            <h2>Giỏ hàng của bạn trống</h2>
            <p>Hãy khám phá các sản phẩm tuyệt vời của chúng tôi!</p>
            <button 
              onClick={() => navigate('/products')} 
              className="btn-shop-now"
            >
              <span>Mua sắm ngay</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="cart-content">
            {/* Cart Items List */}
            <div className="cart-items-section">
              <div className="cart-header">
                <span className="header-product">Sản phẩm</span>
                <span className="header-price">Đơn giá</span>
                <span className="header-quantity">Số lượng</span>
                <span className="header-total">Thành tiền</span>
                <span className="header-action"></span>
              </div>

              <div className="cart-items">
                {cartItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`cart-item ${updating === item.id ? 'updating' : ''}`}
                  >
                    <div className="item-product">
                      <img 
                        src={item.product.image?.startsWith('/') || item.product.image?.startsWith('http') 
                          ? item.product.image 
                          : item.product.image?.includes('/') ? `/storage/${item.product.image}` : `/images/${item.product.image}`}
                        alt={item.product.model}
                        className="product-image"
                        onError={(e) => { e.target.src = '/images/ryosuke.jpg'; }}
                      />
                      <div className="product-info">
                        <h3 className="product-name">
                          {item.product.brand} {item.product.model}
                        </h3>
                        <p className="product-brand">{item.product.brand}</p>
                        <p className="product-details">
                          <span className="detail-item">
                            <span className="detail-label">Màu:</span> {item.product.color}
                          </span>
                          <span className="detail-item">
                            <span className="detail-label">Tỷ lệ:</span> {item.product.scale}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="item-price">
                      <span className="price-value">{formatPrice(item.product.price)} ₫</span>
                    </div>

                    <div className="item-quantity">
                      <div className="quantity-controls">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="qty-btn qty-minus"
                          disabled={updating === item.id}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14"/>
                          </svg>
                        </button>
                        <input 
                          type="number" 
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 0) updateQuantity(item.id, val);
                          }}
                          min="1"
                          className="qty-input"
                          disabled={updating === item.id}
                        />
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="qty-btn qty-plus"
                          disabled={updating === item.id}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="item-total">
                      <span className="total-value">{formatPrice(item.product.price * item.quantity)} ₫</span>
                    </div>

                    <div className="item-action">
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="btn-remove"
                        disabled={updating === item.id}
                        title="Xóa sản phẩm"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-actions">
                <button 
                  onClick={() => navigate('/products')} 
                  className="btn-continue"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  <span>Tiếp tục mua sắm</span>
                </button>
              </div>
            </div>

            {/* Cart Summary */}
            <div className="cart-summary-section">
              <div className="summary-card">
                <h2 className="summary-title">Tóm Tắt Đơn Hàng</h2>
                
                <div className="summary-details">
                  <div className="summary-row">
                    <span className="row-label">Số sản phẩm</span>
                    <span className="row-value">{cartItems.length} sản phẩm</span>
                  </div>
                  <div className="summary-row">
                    <span className="row-label">Tổng số lượng</span>
                    <span className="row-value">
                      {cartItems.reduce((sum, item) => sum + item.quantity, 0)} cái
                    </span>
                  </div>
                  <div className="summary-row subtotal">
                    <span className="row-label">Tạm tính</span>
                    <span className="row-value">{formatPrice(calculateSubtotal())} ₫</span>
                  </div>
                  <div className="summary-row shipping">
                    <span className="row-label">Phí vận chuyển</span>
                    <span className="row-value">{formatPrice(calculateShipping())} ₫</span>
                  </div>
                </div>

                <div className="summary-divider"></div>

                <div className="summary-row total">
                  <span className="row-label">Tổng cộng</span>
                  <span className="row-value total-price">{formatPrice(calculateTotal())} ₫</span>
                </div>

                <button 
                  onClick={handleCheckout} 
                  className="btn-checkout"
                >
                  <span>Tiến hành thanh toán</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>

                <div className="secure-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <span>Thanh toán an toàn & bảo mật</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CartPage;
