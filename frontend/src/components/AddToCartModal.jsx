import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './AddToCartModal.css';

function AddToCartModal({ product, isOpen, onClose, onSuccess }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [variants, setVariants] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchVariants = useCallback(async () => {
    try {
      const response = await axios.get(`/api/products/${product.id}/variants`);
      
      if (response.data.success) {
        setVariants(response.data.variants || []);
        
        // Set default variant (current product)
        const currentVariant = response.data.variants.find(v => v.id === product.id);
        if (currentVariant) {
          setSelectedVariant(currentVariant);
        } else if (response.data.variants.length > 0) {
          setSelectedVariant(response.data.variants[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch variants:', err);
      // Fallback: use product data directly
      setVariants([{
        id: product.id,
        color: product.color,
        price: product.price,
        stock: product.stock,
        image: product.image
      }]);
      setSelectedVariant({
        id: product.id,
        color: product.color,
        price: product.price,
        stock: product.stock,
        image: product.image
      });
    }
  }, [product.id, product.color, product.price, product.stock, product.image]);

  useEffect(() => {
    if (isOpen && product?.id) {
      fetchVariants();
    }
  }, [isOpen, product?.id, fetchVariants]);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      setError('Vui lòng chọn màu sắc');
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      // Guest user - add to guest cart (stored in localStorage for cross-origin merge)
      try {
        setLoading(true);
        setError('');
        
        // Save to localStorage for later merge after login
        const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
        const existingIndex = guestCart.findIndex(item => item.product_id === selectedVariant.id);
        
        if (existingIndex >= 0) {
          guestCart[existingIndex].quantity += quantity;
        } else {
          guestCart.push({
            product_id: selectedVariant.id,
            quantity: quantity
          });
        }
        
        localStorage.setItem('guest_cart', JSON.stringify(guestCart));
        localStorage.setItem('redirectAfterLogin', '/cart');
        
        onSuccess();
        onClose();
        alert('Sản phẩm đã được lưu! Vui lòng đăng nhập để tiếp tục.');
        window.location.href = '/login';
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể thêm vào giỏ hàng');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Logged in user - add to cart
    try {
      setLoading(true);
      setError('');
      await axios.post(
        '/api/cart/add',
        {
          product_id: selectedVariant.id,
          quantity: quantity
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSuccess();
      onClose();
      alert('Đã thêm vào giỏ hàng!');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể thêm vào giỏ hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price);
  };

  const getImagePath = (imageName) => {
    if (!imageName) return '/images/ryosuke.jpg';
    if (imageName.startsWith('/') || imageName.startsWith('http')) return imageName;
    if (imageName.includes('/')) return `/storage/${imageName}`;
    return `/images/${imageName}`;
  };

  // Get max quantity from selected variant
  const maxQuantity = selectedVariant?.stock || 99;

  // Get unique colors from variants
  const availableColors = [...new Set(variants.map(v => v.color).filter(Boolean))];

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="add-to-cart-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        
        <div className="modal-content">
          {/* Product Info */}
          <div className="product-preview">
            <img 
              src={getImagePath(selectedVariant?.image || product.image)}
              alt={product.model}
              className="product-image"
              onError={(e) => { e.target.src = '/images/ryosuke.jpg'; }}
            />
            <div className="product-details">
              <h3 className="product-brand">{product.brand}</h3>
              <h4 className="product-model">{product.model}</h4>
              <p className="product-scale">Tỷ lệ: {product.scale}</p>
              <p className="product-price">
                {formatPrice(selectedVariant?.price || product.price)} ₫
              </p>
            </div>
          </div>

          {/* Color Selection */}
          {availableColors.length > 1 && (
            <div className="color-section">
              <label className="section-label">Chọn màu sắc:</label>
              <div className="color-options">
                {availableColors.map((color) => {
                  const variantForColor = variants.find(v => v.color === color);
                  return (
                    <button
                      key={color}
                      className={`color-btn ${selectedVariant?.color === color ? 'selected' : ''}`}
                      onClick={() => {
                        const variant = variants.find(v => v.color === color);
                        setSelectedVariant(variant);
                      }}
                      title={variantForColor?.stock <= 0 ? 'Hết hàng' : `Còn ${variantForColor?.stock || 0} sản phẩm`}
                      disabled={variantForColor?.stock <= 0}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          <div className="quantity-section">
            <label className="section-label">Số lượng:</label>
            <div className="quantity-controls">
              <button
                className="qty-btn"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= maxQuantity) {
                    setQuantity(val);
                  }
                }}
                min="1"
                max={maxQuantity}
                className="qty-input"
              />
              <button
                className="qty-btn"
                onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                disabled={quantity >= maxQuantity}
              >
                +
              </button>
            </div>
            <p className="stock-info">
              {maxQuantity > 0 ? `Còn lại: ${maxQuantity} sản phẩm` : 'Hết hàng'}
            </p>
          </div>

          {/* Total Price */}
          <div className="total-section">
            <span className="total-label">Tổng cộng:</span>
            <span className="total-price">
              {formatPrice((selectedVariant?.price || product.price) * quantity)} ₫
            </span>
          </div>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button
              className="btn-add"
              onClick={handleAddToCart}
              disabled={loading || maxQuantity <= 0}
            >
              {loading ? 'Đang thêm...' : maxQuantity > 0 ? 'Thêm vào giỏ hàng' : 'Hết hàng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddToCartModal;
