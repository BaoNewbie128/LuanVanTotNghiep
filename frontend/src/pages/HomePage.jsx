import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ChatBot from '../components/ChatBot';
import './HomePage.css';

const getBlogImagePath = (thumbnail) => {
  if (!thumbnail || typeof thumbnail !== 'string') {
    return null;
  }

  if (thumbnail.startsWith('/') || thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
    return thumbnail;
  }

  return `/images/${thumbnail}`;
};

const AI_PRODUCT_FILTERS = {
  '350z': { brand: 'Nissan', model: '350Z' },
  ae86_trueno: { brand: 'Toyota', model: 'AE86 Trueno' },
  civic_eg6: { brand: 'Honda', model: 'Civic EG6' },
  gtr_r34: { brand: 'Nissan', model: 'GTR R34' },
  gtr_r35: { brand: 'Nissan', model: 'GTR R35' },
  impreza: { brand: 'Subaru', model: 'Impreza' },
  lancer_evo_VI: { brand: 'Mitsubishi', model: 'Lancer Evo VI' },
  nsx: { brand: 'Honda', model: 'NSX' },
  rx7_fc: { brand: 'Mazda', model: 'RX7 FC' },
  rx7_fd: { brand: 'Mazda', model: 'RX7 FD' },
  s2000: { brand: 'Honda', model: 'S2000' },
  silvia_s15: { brand: 'Nissan', model: 'Silvia S15' },
  supra_mk4: { brand: 'Toyota', model: 'Supra MK4' },
  supra_mk5: { brand: 'Toyota', model: 'Supra MK5' },
};

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [homeNotifications, setHomeNotifications] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [brands, setBrands] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Page Break state
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalProductCount, setTotalProductCount] = useState(0);

  // Statistics
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalBrands: 0
  });

  // All products for brand counting (fetch all for accurate counts)
  const [allProducts, setAllProducts] = useState([]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: currentPage,
        per_page: 12,
        sort_by: sortBy
      });

      if (selectedBrand) {
        params.append("brand", selectedBrand);
      }

      if (searchTerm) {
        params.append("model", searchTerm);
      }

      if (selectedColor) {
        params.append("color", selectedColor);
      }

      const response = await fetch(
        `/api/products?${params}`
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || result.error || `API sản phẩm trả về lỗi ${response.status}`);
      }

      const productData = Array.isArray(result.data) ? result.data : [];
      const pagination = result.pagination || {};
      const resolvedLastPage = Math.max(Number(pagination.last_page) || 1, 1);
      const resolvedCurrentPage = Math.min(Number(pagination.current_page) || 1, resolvedLastPage);

      setProducts(productData);
      setCurrentPage(resolvedCurrentPage);
      setLastPage(resolvedLastPage);
      setTotalProductCount(Number(pagination.total) || productData.length);
      setError(null);

    } catch (err) {
      setProducts([]);
      setError(err.message || 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedBrand, selectedColor, searchTerm, sortBy]);

  // Fetch all products for brand counting
  const fetchAllProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/products?per_page=1000");
      const result = await response.json();
      setAllProducts(result.data || []);
    } catch (err) {
      console.error('Error fetching all products:', err);
    }
  }, []);

  const fetchFilters = useCallback(async () => {
    try {
      const response = await fetch("/api/filters");
      const data = await response.json();
      setBrands(Array.isArray(data.brands) ? data.brands : []);
      setColors(Array.isArray(data.colors) ? data.colors : []);
      
      // Set statistics
      setStats({
        totalProducts: data.total_products || 0,
        totalBrands: Array.isArray(data.brands) ? data.brands.length : 0
      });
    } catch (err) {
      console.error('Error fetching filters:', err);
    }
  }, []);

  const fetchLatestPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/posts?per_page=3');
      const result = await response.json();
      setBlogPosts(result?.data?.data || []);
    } catch (err) {
      console.error('Error fetching blog posts:', err);
    }
  }, []);

  const fetchHomeNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/notifications?per_page=3', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const result = await response.json();
      setHomeNotifications(response.ok && Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
    fetchAllProducts();
    fetchLatestPosts();
    fetchHomeNotifications();
  }, [fetchFilters, fetchAllProducts, fetchLatestPosts, fetchHomeNotifications]);

  const handleResetFilters = () => {
    setSelectedBrand('');
    setSelectedColor('');
    setSearchTerm('');
    setSortBy('newest');
  };

  const handleAiProductFilter = useCallback((prediction) => {
    const filter = AI_PRODUCT_FILTERS[prediction?.label];
    if (!filter) return;

    setSelectedBrand(filter.brand);
    setSearchTerm(filter.model);
    setSelectedColor('');
    setCurrentPage(1);

    window.setTimeout(() => {
      document.getElementById('featured-products')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const fetchWishlist = useCallback(async () => {
    try {
      const response = await fetch('/api/wishlist', {
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (result?.success !== true) {
        throw new Error(result?.message || result?.error || 'Wishlist API failed');
      }

      const serverIds = (result.data || [])
        .map((item) => Number(item.product_id || item.product?.id))
        .filter(Boolean);
      const localGuestIds = JSON.parse(localStorage.getItem('guest_wishlist') || '[]')
        .map((item) => Number(item.product_id))
        .filter(Boolean);

      setWishlistIds([...new Set([...serverIds, ...localGuestIds])]);
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
      const localGuestIds = JSON.parse(localStorage.getItem('guest_wishlist') || '[]')
        .map((item) => Number(item.product_id))
        .filter(Boolean);
      setWishlistIds(localGuestIds);
    }
  }, []);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const handleAddToWishlist = async (product, shouldAdd = true) => {
    const token = localStorage.getItem('token');
    const productId = Number(product?.id);

    if (!productId) {
      throw new Error('Thiếu mã sản phẩm khi cập nhật yêu thích');
    }

    if (shouldAdd) {
      const response = await fetch('/api/wishlist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ product_id: productId }),
      });
      const result = await response.json();

      if (!response.ok || result?.success !== true) {
        throw new Error(result?.error || result?.message || 'Add wishlist request failed');
      }

      if (token && result?.is_guest === true) {
        throw new Error('Wishlist was not saved for authenticated user');
      }

      if (!token) {
        const guestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]');
        if (!guestWishlist.some((item) => Number(item.product_id) === productId)) {
          guestWishlist.push({ product_id: productId, added_at: new Date().toISOString() });
          localStorage.setItem('guest_wishlist', JSON.stringify(guestWishlist));
        }
      }

      setWishlistIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
      window.dispatchEvent(new Event('wishlistUpdated'));
      return { success: true, inWishlist: true };
    }

    const response = await fetch(`/api/wishlist/remove/${productId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const result = await response.json();

    if (!response.ok || result?.success !== true) {
      throw new Error(result?.error || result?.message || 'Remove wishlist request failed');
    }

    if (!token) {
      const guestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]')
        .filter((item) => Number(item.product_id) !== productId);
      localStorage.setItem('guest_wishlist', JSON.stringify(guestWishlist));
    }

    setWishlistIds((prev) => prev.filter((id) => id !== productId));
    window.dispatchEvent(new Event('wishlistUpdated'));
    return { success: true, inWishlist: false };
  };

  // Get brand logo image path
  const getBrandLogo = (brandName) => {
    const logoMap = {
      'Toyota': '/images/logo/toyota_logo.jpg',
      'Nissan': '/images/logo/nissan_logo.jpg',
      'Mazda': '/images/logo/Mazda_Logo.png',
      'Honda': '/images/logo/honda_logo.jpg',
      'Mitsubishi': '/images/logo/mitsubishi_logo.png',
      'Subaru': '/images/logo/subaru_logo.jpg',
    };
    return logoMap[brandName] || '/images/ryosuke.jpg';
  };

  // Brand groups with accurate counts from all products
  const brandCategories = [
    { name: 'Toyota', count: allProducts.filter(p => p.brand === 'Toyota').length },
    { name: 'Nissan', count: allProducts.filter(p => p.brand === 'Nissan').length },
    { name: 'Mazda', count: allProducts.filter(p => p.brand === 'Mazda').length },
    { name: 'Honda', count: allProducts.filter(p => p.brand === 'Honda').length },
    { name: 'Mitsubishi', count: allProducts.filter(p => p.brand === 'Mitsubishi').length },
    { name: 'Subaru', count: allProducts.filter(p => p.brand === 'Subaru').length },
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="hero-title-main">MÔ HÌNH JDM</span>
            <span className="hero-title-sub">CHẤT LƯỢNG CAO</span>
          </h1>
          <p className="hero-description">
            Khám phá bộ sưu tập mô hình xe JDM đích thực với độ chi tiết hoàn hảo. 
            Được thiết kế dành riêng cho các tín đồ đam mê xe hơi.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary">
              KHÁM PHÁ NGAY
              <span className="material-symbols-outlined"></span>
            </Link>
            <Link to="/products" className="btn btn-secondary">
              XEM BỘ SƯU TẬP
            </Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-number">{stats.totalProducts}+</span>
            <span className="stat-label">Sản Phẩm</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.totalBrands}</span>
            <span className="stat-label">Hãng Xe</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">1:32</span>
            <span className="stat-label">Tỷ Lệ</span>
          </div>
        </div>
      {/* Brand Section */}

      {/* Brand Categories */}
          <h2 className="section-title">Các hãng xe JDM lừng danh</h2>
        <div className="section-header">
            Khám phá bộ sưu tập theo từng hãng xe Nhật Bản huyền thoại
          <p className="section-subtitle">Lọc mô hình theo các hãng xe Nhật Bản nổi tiếng</p>
        </div>
        <div className="categories-grid">
          {brandCategories.map((brand) => (
            <Link 
              to={`/products?brand=${encodeURIComponent(brand.name)}`} 
              key={brand.name} 
              className="category-card"
            >
              <div className="category-image">
                <img 
                  src={getBrandLogo(brand.name)} 
                  alt={brand.name}
                  onError={(e) => {
                    e.target.src = '/images/ryosuke.jpg';
                  }}
                />
                <div className="category-overlay"></div>
              </div>
              <div className="category-info">
                <h3 className="category-name">{brand.name}</h3>
                <span className="category-count">{brand.count} sản phẩm</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {homeNotifications.length > 0 && (
        <section className="home-notifications-section">
          <div className="home-notifications-heading">
            <div><span>CẬP NHẬT DÀNH CHO BẠN</span><h2>Thông báo mới nhất</h2></div>
            <Link to="/notifications">Xem trung tâm thông báo →</Link>
          </div>
          <div className="home-notifications-grid">
            {homeNotifications.map((notification) => (
              <Link to={notification.action_url || '/notifications'} className={`home-notification-card type-${notification.type}`} key={notification.id}>
                <span className="home-notification-icon">{notification.type === 'order' ? '📦' : notification.type === 'flash_sale' ? '⚡' : notification.type === 'voucher' ? '🎁' : notification.type === 'support' ? '💬' : '🔔'}</span>
                <div><small>{notification.type === 'order' ? 'ĐƠN HÀNG' : notification.type === 'flash_sale' ? 'FLASH SALE' : notification.type === 'voucher' ? 'VOUCHER' : notification.type === 'support' ? 'HỖ TRỢ' : 'THÔNG BÁO'}</small><h3>{notification.title}</h3><p>{notification.content}</p></div>
                {!notification.is_read && <i />}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="featured-section" id="featured-products">
        <div className="section-header">
          <h2 className="section-title">Sản Phẩm Nổi Bật</h2>
          <p className="section-subtitle">Phiên bản giới hạn, hàng sưu tầm có sẵn để giao ngay</p>
        </div>

        {/* Filters Section */}
        <div className="filters-container">
          <div className="filter-group">
            <label>Tìm Kiếm</label>
            <input
              type="text"
              placeholder="Hãng, model, giá, tỷ lệ..."
              value={searchTerm}
              className="search-input"
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="filter-group">
            <label>Hãng Xe</label>
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Tất Cả Hãng</option>
              {Array.isArray(brands) && brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Màu Sắc</label>
            <select
              value={selectedColor}
              onChange={(e) => {
                setSelectedColor(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Tất Cả Màu</option>
              {colors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Sắp xếp</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="newest">Mới Nhất</option>
              <option value="price-low">Giá Thấp Đến Cao</option>
              <option value="price-high">Giá Cao Đến Thấp</option>
              <option value="popular">Bán Chạy Nhất</option>
            </select>
          </div>

          <button className="reset-btn" onClick={handleResetFilters}>
            Xóa Bộ Lọc
          </button>
        </div>

        {loading && <p className="loading">Đang tải sản phẩm...</p>}
        {error && <p className="error">Lỗi: {error}</p>}
        
        {!loading && !error && (
          <>
            <div className="products-count">
              Tổng cộng {totalProductCount} sản phẩm (đang hiển thị {products.length} sản phẩm trên trang này. Xem thêm tại <Link to="/products">trang sản phẩm</Link>)
            </div>
            <div className="products-grid">
              {products.length > 0 ? (
                products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToWishlist={handleAddToWishlist}
                    initialWishlisted={wishlistIds.includes(Number(product.id))}
                  />
                ))
              ) : (
                <p className="no-products">Không có sản phẩm nào</p>
              )}
            </div>
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                ⏮
              </button>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ◀
              </button>
              <span>
                Trang {currentPage} / {lastPage}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === lastPage}
              >
                ▶
              </button>
              <button
                onClick={() => setCurrentPage(lastPage)}
                disabled={currentPage === lastPage}
              >
                ⏭
              </button>
            </div>
          </>
        )}
      </section>

      {/* Blog Section */}
      <section className="blog-home-section">
        <div className="section-header">
          <h2 className="section-title">JDM BLOG</h2>
          <p className="section-subtitle">
            Cập nhật kiến thức lịch sử các dòng xe JDM, văn hóa diecast và mẹo sưu tầm mới nhất.
          </p>
        </div>

        {blogPosts.length > 0 ? (
          <div className="blog-home-grid">
            {blogPosts.map((post) => (
              <article key={post.id} className="blog-home-card">
                <div className="blog-home-card__media">
                  {post.thumbnail ? (
                    <img
                      src={getBlogImagePath(post.thumbnail)}
                      alt={post.title}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="blog-home-card__placeholder">BLOG</div>
                  )}
                </div>
                <div className="blog-home-card__content">
                  <span className="blog-home-card__meta">
                    {post.created_at ? new Date(post.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                  </span>
                  <h3>{post.title}</h3>
                  <p>
                    {String(post.meta_description || post.content || '')
                      .replace(/<[^>]*>/g, '')
                      .slice(0, 140)}
                    ...
                  </p>
                  <Link to={`/blog/${post.slug}`} className="blog-home-card__link">
                    Đọc tiếp
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="blog-home-empty">Blog đang được cập nhật. Vui lòng quay lại sau.</div>
        )}

        <div className="blog-home-actions">
          <Link to="/blog" className="btn btn-secondary">
            Xem tất cả bài viết
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 19 6v5c0 4.6-2.9 8.2-7 10-4.1-1.8-7-5.4-7-10V6l7-3Z" />
                <path d="m8.5 12 2.2 2.2 4.8-5" />
              </svg>
            </div>
            <h3 className="feature-title">Sản Phẩm Chính Hãng</h3>
            <p className="feature-description">100% authentic với độ chi tiết hoàn hảo</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
                <circle cx="7" cy="18" r="2" />
                <circle cx="18" cy="18" r="2" />
              </svg>
            </div>
            <h3 className="feature-title">Giao Hàng Nhanh</h3>
            <p className="feature-description">Giao hàng nhanh chóng trên toàn quốc</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18M7 15h4" />
              </svg>
            </div>
            <h3 className="feature-title">Thanh Toán An Toàn</h3>
            <p className="feature-description">Nhiều hình thức thanh toán tiện lợi</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
                <path d="M4 12h2a2 2 0 0 1 2 2v3H6a2 2 0 0 1-2-2v-3ZM20 12h-2a2 2 0 0 0-2 2v3h2a2 2 0 0 0 2-2v-3ZM16 19c-1 1-2.2 1.5-4 1.5" />
              </svg>
            </div>
            <h3 className="feature-title">Hỗ Trợ 24/7</h3>
            <p className="feature-description">Đội ngũ hỗ trợ luôn sẵn sàng</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">JDM WORLD</span>
            <p className="footer-description">
              Mô hình sưu tầm được thiết kế dành riêng cho các tín đồ automotive thuần túy. 
              Hỗ trợ giao hàng toàn quốc từ trung tâm vận hành tại TP Hồ Chí Minh.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4 className="footer-title">Company</h4>
              <Link to="#" className="footer-link">Điều khoản dịch vụ</Link>
              <Link to="#" className="footer-link">Chính sách quyền riêng tư</Link>
              <Link to="https://www.instagram.com/jdm/" className="footer-link">Instagram</Link>
              <Link to="https://www.youtube.com/@JDMMasters" className="footer-link">YouTube</Link>
            </div>
            <div className="footer-column">
              <h4 className="footer-title">Support</h4>
              <Link to="/products" className="footer-link">Vận chuyển</Link>
              <Link to="/products" className="footer-link">Thông số kỹ thuật</Link>
              <Link to="/faq" className="footer-link">FAQ & Liên hệ hỗ trợ</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2024 JDM WORLD. ALL RIGHTS RESERVED.</span>
        </div>
      </footer>

      <ChatBot onPrediction={handleAiProductFilter} />
    </div>
  );
}
