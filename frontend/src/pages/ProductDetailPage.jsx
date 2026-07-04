import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/ProductDetail.css';

const FALLBACK_IMAGE = '/images/ryosuke.jpg';

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [colorVariants, setColorVariants] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`/api/products/${id}`, {
          headers: getAuthHeaders(),
        });
        const data = response.data;

        if (!data?.success || !data?.product) {
          setError(data?.error || 'Không tìm thấy sản phẩm');
          return;
        }

        setProduct(data.product);
        setColorVariants(data.color_variants || []);
        setRelatedProducts(data.related_products || []);
        setRecommendations(data.recommendations || []);
        setAvgRating(data.avg_rating || 0);
        setReviewCount(data.review_count || 0);
        if (typeof data.product?.is_wished === 'boolean') {
          setIsWishlisted(data.product.is_wished);
        }
        setQuantity(data.product?.stock > 0 ? 1 : 0);
      } catch (err) {
        console.error('Failed to fetch product:', err);
        setError(err.response?.data?.error || 'Không thể tải chi tiết sản phẩm');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    const checkWishlist = async () => {
      try {
        const response = await axios.get(`/api/wishlist/check/${id}`, {
          headers: getAuthHeaders(),
        });

        const localGuestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]');
        const isInLocalGuest = localGuestWishlist.some((item) => Number(item.product_id) === Number(id));
        setIsWishlisted(Boolean(response.data?.in_wishlist || isInLocalGuest));
      } catch (err) {
        console.error('Failed to check wishlist:', err);
        const localGuestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]');
        setIsWishlisted(localGuestWishlist.some((item) => Number(item.product_id) === Number(id)));
      }
    };

    if (id) {
      checkWishlist();
    }
  }, [id]);

  const productName = useMemo(() => {
    return [product?.brand, product?.model].filter(Boolean).join(' ') || 'Chi tiết sản phẩm';
  }, [product]);

  const formatCurrency = (price) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(price || 0));
  };

  const getImagePath = (imageName) => {
    if (!imageName) return FALLBACK_IMAGE;
    if (imageName.startsWith('/') || imageName.startsWith('http')) return imageName;
    if (imageName.includes('/')) return `/storage/${imageName}`;
    return `/images/${imageName}`;
  };

  const renderStars = (rating) => {
    const roundedRating = Math.round(Number(rating || 0));
    return Array.from({ length: 5 }, (_, index) => (
      <span key={index} className={index < roundedRating ? 'filled' : ''}>★</span>
    ));
  };

  const handleQuantityChange = (nextQuantity) => {
    const stock = Number(product?.stock || 0);
    setQuantity(Math.min(Math.max(nextQuantity, stock > 0 ? 1 : 0), stock));
  };

  const handleAddToCart = async () => {
    if (!product || product.stock <= 0 || quantity <= 0) return;

    const token = localStorage.getItem('token');

    try {
      setAddingToCart(true);
      if (token) {
        await axios.post(
          '/api/cart/add',
          { product_id: product.id, quantity },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Đã thêm sản phẩm vào giỏ hàng!');
      } else {
        await axios.post('/api/cart/add-guest', {
          product_id: product.id,
          quantity,
        });
        localStorage.setItem('redirectAfterLogin', '/cart');
        alert('Sản phẩm đã được lưu! Vui lòng đăng nhập để tiếp tục.');
        navigate('/login');
      }
    } catch (err) {
      console.error('Failed to add to cart:', err);
      alert(err.response?.data?.message || 'Không thể thêm vào giỏ hàng');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleWishlist = async () => {
    if (!product || wishlistLoading) return;

    const nextState = !isWishlisted;
    setWishlistLoading(true);

    try {
      const token = localStorage.getItem('token');

      if (nextState) {
        const response = await axios.post(
          '/api/wishlist/add',
          { product_id: product.id },
          { headers: getAuthHeaders() }
        );

        if (response.status !== 200 && response.status !== 201) {
          throw new Error('Add wishlist request failed');
        }

        if (token && (response.data?.success !== true || response.data?.is_guest === true)) {
          throw new Error(response.data?.error || 'Wishlist was not saved for authenticated user');
        }

        if (!token) {
          const guestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]');
          if (!guestWishlist.some((item) => Number(item.product_id) === Number(product.id))) {
            guestWishlist.push({ product_id: Number(product.id), added_at: new Date().toISOString() });
            localStorage.setItem('guest_wishlist', JSON.stringify(guestWishlist));
          }
        }
      } else {
        const response = await axios.delete(`/api/wishlist/remove/${product.id}`, {
          headers: getAuthHeaders(),
        });

        if (response.status !== 200 || response.data?.success !== true) {
          throw new Error(response.data?.error || 'Remove wishlist request failed');
        }

        if (!token) {
          const guestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]')
            .filter((item) => Number(item.product_id) !== Number(product.id));
          localStorage.setItem('guest_wishlist', JSON.stringify(guestWishlist));
        }
      }
      setIsWishlisted(nextState);
      window.dispatchEvent(new Event('wishlistUpdated'));
    } catch (err) {
      console.error('Failed to update wishlist:', err);
      alert(err.response?.data?.error || err.response?.data?.message || 'Không thể cập nhật yêu thích');
    } finally {
      setWishlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="product-detail-loading">Đang tải chi tiết sản phẩm...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-detail-container">
        <div className="product-detail-error">
          <h2>Không thể hiển thị sản phẩm</h2>
          <p>{error}</p>
          <button type="button" onClick={() => navigate('/products')}>Quay lại danh sách</button>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const isInStock = Number(product?.stock || 0) > 0;
  const reviews = product?.reviews || [];
  const recommendedProducts = recommendations.slice(0, 8);
  const recommendedIds = new Set(recommendedProducts.map((item) => Number(item.id)));
  const relatedSuggestions = relatedProducts.filter((item) => !recommendedIds.has(Number(item.id))).slice(0, 4);

  return (
    <div className="product-detail-container">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <span onClick={() => navigate('/')}>Trang chủ</span>
        <span> / </span>
        <span onClick={() => navigate('/products')}>Sản phẩm</span>
        <span> / </span>
        <strong>{productName}</strong>
      </nav>

      <section className="product-main-section">
        <div className="product-gallery">
          <div className="main-image">
            <img
              src={getImagePath(product?.image)}
              alt={productName}
              onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
            />
          </div>

          {colorVariants.length > 0 && (
            <div className="thumbnail-list" aria-label="Các phiên bản màu">
              {colorVariants.map((variant) => (
                <button
                  type="button"
                  key={variant.id}
                  className={`thumbnail ${variant.id === product.id ? 'active' : ''}`}
                  onClick={() => navigate(`/products/${variant.id}`)}
                >
                  <img
                    src={getImagePath(variant.image)}
                    alt={variant.color || productName}
                    onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
                  />
                  <span className="thumbnail-color">{variant.color || 'Màu khác'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info product-detail-info-panel">
          <div className="product-header">
            <span className="brand-badge">{product?.brand || 'JDM World'}</span>
            <h1 className="product-title">{productName}</h1>
          </div>

          <div className="rating-section">
            <div className="stars" aria-label={`Đánh giá ${avgRating}/5`}>{renderStars(avgRating)}</div>
            <span className="rating-text">{Number(avgRating || 0).toFixed(1)}</span>
            <span className="review-count">({reviewCount} đánh giá)</span>
          </div>

          <div className="price-section">
            <span className="current-price">{formatCurrency(product?.price)}</span>
          </div>

          <div className="product-tags">
            <span className="tag">Scale: {product?.scale || 'N/A'}</span>
            <span className="tag">Color: {product?.color || 'N/A'}</span>
            <span className="tag">Model: {product?.model || 'N/A'}</span>
          </div>

          <div className="stock-status">
            {isInStock ? <span className="in-stock">Tồn kho: {product?.stock} - Còn hàng</span> : <span className="out-of-stock">Hết hàng</span>}
          </div>

          <div className="purchase-section">
            <div className="quantity-selector">
              <label>Số lượng</label>
              <div className="quantity-controls">
                <button type="button" onClick={() => handleQuantityChange(quantity - 1)} disabled={!isInStock || quantity <= 1}>-</button>
                <input
                  type="number"
                  min={isInStock ? 1 : 0}
                  max={product?.stock || 0}
                  value={quantity}
                  onChange={(event) => handleQuantityChange(Number(event.target.value))}
                  disabled={!isInStock}
                />
                <button type="button" onClick={() => handleQuantityChange(quantity + 1)} disabled={!isInStock || quantity >= Number(product?.stock || 0)}>+</button>
              </div>
            </div>

            <div className="action-buttons">
              <button type="button" className="btn-add-to-cart" onClick={handleAddToCart} disabled={!isInStock || addingToCart}>
                {addingToCart ? 'Đang thêm...' : 'Thêm vào giỏ hàng'}
              </button>
              <button
                type="button"
                className={`btn-wishlist ${isWishlisted ? 'active' : ''}`}
                aria-label={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                title={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                onClick={handleWishlist}
                disabled={wishlistLoading}
              >
                ♥
              </button>
            </div>
          </div>

          <div className="product-meta">
            <div className="meta-item"><span className="label">Mã SP:</span><span className="value">#{product?.id}</span></div>
            <div className="meta-item"><span className="label">Thương hiệu:</span><span className="value">{product?.brand || 'N/A'}</span></div>
          </div>
        </div>
      </section>

      <section className="product-tabs-section">
        <div className="tabs-header">
          <button type="button" className="tab-btn active">Mô tả sản phẩm</button>
          <button type="button" className="tab-btn">Đánh giá</button>
        </div>

        <div className="tabs-content product-detail-content-grid">
          <article className="tab-panel description-content">
            <h2>Mô tả sản phẩm</h2>
            <p>{product?.description || 'Sản phẩm hiện chưa có mô tả chi tiết.'}</p>
          </article>

          <article className="tab-panel reviews-content">
            <div className="reviews-header">
              <h2>Đánh giá khách hàng</h2>
              <span>{reviewCount} đánh giá</span>
            </div>

            {reviews.length > 0 ? (
              <div className="reviews-list">
                {reviews.map((review) => (
                  <div key={review.id} className="review-item">
                    <div className="review-item-header">
                      <strong>{review.user?.username || review.user?.name || 'Khách hàng'}</strong>
                      <div className="stars">{renderStars(review.rating)}</div>
                    </div>
                    <p>{review.comment || 'Không có nội dung đánh giá.'}</p>
                    {review.images?.length > 0 && (
                      <div className="product-review-images">
                        {review.images.map((image) => (
                          <a key={image.id} href={`/storage/${image.image_url}`} target="_blank" rel="noreferrer">
                            <img src={`/storage/${image.image_url}`} alt="Ảnh thực tế từ khách hàng" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-reviews">Chưa có đánh giá nào cho sản phẩm này.</div>
            )}
          </article>
        </div>
      </section>

      {recommendedProducts.length > 0 && (
        <section className="product-suggestions-section purchase-recommendations">
          <div className="recommendation-heading">
            <span>GỢI Ý TỪ CỘNG ĐỒNG SƯU TẦM</span>
            <h2>Khách hàng mua mô hình này cũng mua...</h2>
            <p>Dựa trên lựa chọn thực tế của những khách hàng có cùng sở thích.</p>
          </div>
          <div className="suggestion-grid">
            {recommendedProducts.map((item) => (
              <button type="button" key={`${item.id}-${item.model}`} className="suggestion-card" onClick={() => navigate(`/products/${item.id}`)}>
                <small className="recommendation-badge">{item.recommendation_source === 'customer_purchases' ? 'Mua cùng' : 'Phù hợp với bạn'}</small>
                <img
                  src={getImagePath(item.image)}
                  alt={`${item.brand || ''} ${item.model || ''}`}
                  onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
                />
                <span>{[item.brand, item.model].filter(Boolean).join(' ')}</span>
                <small className="recommendation-reason">{item.recommendation_reason}</small>
                <strong>{formatCurrency(item.price)}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {relatedSuggestions.length > 0 && (
        <section className="product-suggestions-section related-suggestions">
          <h2>Có thể bạn cũng thích</h2>
          <div className="suggestion-grid">
            {relatedSuggestions.map((item) => (
              <button type="button" key={`related-${item.id}`} className="suggestion-card" onClick={() => navigate(`/products/${item.id}`)}>
                <img src={getImagePath(item.image)} alt={`${item.brand || ''} ${item.model || ''}`} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />
                <span>{[item.brand, item.model].filter(Boolean).join(' ')}</span>
                <strong>{formatCurrency(item.price)}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetailPage;
