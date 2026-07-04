import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import '../styles/ProductCard.css';
import AddToCartModal from './AddToCartModal';


function ProductCard({ product, onAddToWishlist, onCartUpdate, initialWishlisted = false }) {
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');

  const averageRating = Number(product?.reviews_avg_rating || 0);
  const reviewsCount = Number(product?.reviews_count || 0);
  const hasReviews = reviewsCount > 0;
  const roundedRating = hasReviews ? Math.round(averageRating * 10) / 10 : 0;
  const filledStars = hasReviews ? Math.round(averageRating) : 0;

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => {
      const isFilled = index < filledStars;

      return (
        <span
          key={`${product?.id || 'product'}-star-${index}`}
          className={`rating-star ${isFilled ? 'filled' : 'empty'}`}
          aria-hidden="true"
        >
          ★
        </span>
      );
    });
  };

  useEffect(() => {
    setIsWishlisted(initialWishlisted);
  }, [initialWishlisted, product?.id]);

  useEffect(() => {
    if (!showReviewsModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowReviewsModal(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showReviewsModal]);

  // Helper function to get the correct image path
  const getImagePath = (imageName) => {
    if (!imageName) return '/images/ryosuke.jpg';
    // If it's already a full path, use it directly
    if (imageName.startsWith('/') || imageName.startsWith('http')) return imageName;
    if (imageName.includes('/')) return `/storage/${imageName}`;
    // Otherwise prepend /images/
    return `/images/${imageName}`;
  };

  const getReviewImagePath = (imageName) => {
    if (!imageName) return '';
    if (imageName.startsWith('http')) return imageName;
    return `/storage/${imageName.replace(/^\//, '')}`;
  };

  const handleAddToCart = () => {
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleModalSuccess = () => {
    if (onCartUpdate) {
      onCartUpdate();
    }
  };

  const formatReviewDate = (value) => {
    if (!value) return 'Không rõ thời gian';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Không rõ thời gian';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const renderReviewStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => {
      const isFilled = index < Number(rating || 0);

      return (
        <span
          key={`review-star-${rating}-${index}`}
          className={`rating-star ${isFilled ? 'filled' : 'empty'}`}
          aria-hidden="true"
        >
          ★
        </span>
      );
    });
  };

  const handleOpenReviews = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!product?.id) {
      return;
    }

    setShowReviewsModal(true);
    setReviewsLoading(true);
    setReviewsError('');

    try {
      const response = await api.get(`/products/${product.id}/reviews`);
      setReviews(response.data?.data || []);
    } catch (error) {
      setReviews([]);
      setReviewsError(error.response?.data?.error || 'Không thể tải chi tiết đánh giá lúc này.');
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleCloseReviews = () => {
    setShowReviewsModal(false);
  };

  const handleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (wishlistLoading || !onAddToWishlist) return;

    if (!product?.id) {
      console.error('Wishlist action failed: product.id is missing', product);
      alert('Không tìm thấy mã sản phẩm để cập nhật yêu thích');
      return;
    }

    const nextState = !isWishlisted;
    setWishlistLoading(true);

    try {
      const result = await onAddToWishlist(product, nextState);
      if (result?.success !== true) {
        throw new Error(result?.message || 'Wishlist API did not confirm success');
      }
      setIsWishlisted(Boolean(result.inWishlist));
    } catch (error) {
      console.error('Wishlist action failed:', error);
      alert(error?.response?.data?.error || error?.response?.data?.message || 'Không thể cập nhật yêu thích');
    } finally {
      setWishlistLoading(false);
    }
  };

  return (
    <>
      <article className="catalog-product-card">
        <div className="product-image-container">
          <img 
            src={getImagePath(product.image)}
            alt={product.model || 'Product Image'}
            className="product-image"
            onError={(e) => {
              e.target.src = '/images/ryosuke.jpg';
            }}
          />
          <div className="product-overlay">
            <button className="btn-view" onClick={() => window.location.href = `/products/${product.id}`}>
              Xem Chi Tiết
            </button>
          </div>
          <button 
            className={`btn-wishlist ${isWishlisted ? 'active' : ''}`}
            onClick={handleWishlist}
            disabled={wishlistLoading}
            title={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
            type="button"
          >
            ♥
          </button>
        </div>
        
        <div className="product-info">
          <h3 className="product-brand">{product.brand}</h3>
          <h4 className="product-model">{product.model}</h4>
          <button
            type="button"
            className="product-rating product-rating-button"
            onClick={handleOpenReviews}
            aria-label={`Xem đánh giá của sản phẩm ${product.model || ''}`}
          >
            <div className="product-rating-stars">{renderStars()}</div>
            <span className="product-rating-text">
              {hasReviews
                ? `${roundedRating.toFixed(1)} (${reviewsCount} đánh giá)`
                : '(Chưa có đánh giá)'}
            </span>
          </button>
          <p className="product-color">Màu: {product.color}</p>
          <p className="product-scale">Tỷ lệ: {product.scale}</p>
          
          <div className="product-footer">
            <span className="product-price">
              {new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND'
              }).format(product.price)}
            </span>
            <button 
              className="btn-add-cart"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              {product.stock === 0 ? 'Hết Hàng' : 'Thêm Vào Giỏ'}
            </button>
          </div>
          
          {product.stock < 5 && product.stock > 0 && (
            <p className="low-stock-warning">Chỉ còn {product.stock} sản phẩm!</p>
          )}
        </div>
      </article>

      {/* Add to Cart Modal */}
      <AddToCartModal 
        product={product}
        isOpen={showModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      {showReviewsModal && createPortal(
        <div className="reviews-modal-overlay" onMouseDown={handleCloseReviews} role="presentation">
          <section
            className="product-reviews-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`reviews-title-${product.id}`}
          >
            <button type="button" className="reviews-modal-close" onClick={handleCloseReviews} aria-label="Đóng đánh giá">
              ×
            </button>

            <div className="reviews-modal-content">
              <header className="reviews-modal-header">
                <img
                  className="reviews-modal-product-image"
                  src={getImagePath(product.image)}
                  alt={product.model || 'Sản phẩm'}
                  onError={(event) => { event.currentTarget.src = '/images/ryosuke.jpg'; }}
                />
                <div>
                  <p className="reviews-modal-brand">{product.brand}</p>
                  <h3 id={`reviews-title-${product.id}`} className="reviews-modal-title">Đánh giá cho {product.model}</h3>
                </div>
              </header>

              <div className="reviews-modal-summary">
                <strong className="reviews-score">{hasReviews ? roundedRating.toFixed(1) : '—'}</strong>
                <div>
                  <div className="product-rating-stars">{renderStars()}</div>
                  <span className="product-rating-text">
                    {hasReviews
                      ? `${roundedRating.toFixed(1)} trên 5 (${reviewsCount} đánh giá)`
                      : 'Chưa có đánh giá cho sản phẩm này'}
                  </span>
                </div>
              </div>

              {reviewsLoading ? (
                <div className="reviews-state">Đang tải danh sách đánh giá...</div>
              ) : reviewsError ? (
                <div className="reviews-state reviews-error">{reviewsError}</div>
              ) : reviews.length === 0 ? (
                <div className="reviews-state">Hiện chưa có lượt đánh giá nào cho sản phẩm này.</div>
              ) : (
                <div className="reviews-list">
                  {reviews.map((review) => (
                    <div key={review.id} className="review-item">
                      <div className="review-item-header">
                        <div>
                          <h4 className="review-user-name">{review.user?.name || 'Khách hàng'}</h4>
                          <div className="review-item-stars">{renderReviewStars(review.rating)}</div>
                        </div>
                        <span className="review-date">{formatReviewDate(review.created_at)}</span>
                      </div>

                      <p className="review-comment">
                        {review.comment?.trim() || 'Khách hàng chưa để lại bình luận chi tiết.'}
                      </p>
                      {review.images?.length > 0 && (
                        <div className="review-gallery">
                          {review.images.map((image) => (
                            <a key={image.id} href={getReviewImagePath(image.image_url)} target="_blank" rel="noreferrer">
                              <img src={getReviewImagePath(image.image_url)} alt="Ảnh thực tế từ khách hàng" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

export default ProductCard;
