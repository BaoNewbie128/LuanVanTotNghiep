import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { SkeletonCard } from '../components/SkeletonLoader';
import './ProductListPage.css';

const PER_PAGE = 12;

function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [brands, setBrands] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(searchParams.get('brand')?.trim() || '');
  const [selectedColor, setSelectedColor] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        per_page: String(PER_PAGE),
        sort_by: sortBy,
      });

      if (selectedBrand) params.set('brand', selectedBrand);
      if (selectedColor) params.set('color', selectedColor);
      if (searchTerm.trim()) params.set('model', searchTerm.trim());

      const response = await fetch(`/api/products?${params}`, {
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      if (!response.ok || result?.success !== true) {
        throw new Error(result?.error || result?.message || 'Không thể tải sản phẩm');
      }

      const pagination = result.pagination || {};
      const resolvedLastPage = Math.max(Number(pagination.last_page) || 1, 1);
      const resolvedCurrentPage = Math.min(Number(pagination.current_page) || 1, resolvedLastPage);

      setProducts(Array.isArray(result.data) ? result.data : []);
      setCurrentPage(resolvedCurrentPage);
      setLastPage(resolvedLastPage);
      setTotalProducts(Number(pagination.total) || 0);
    } catch (requestError) {
      setProducts([]);
      setError(requestError.message || 'Không thể tải sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedBrand, selectedColor, sortBy]);

  const fetchFilters = useCallback(async () => {
    try {
      const response = await fetch('/api/filters');
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Không thể tải bộ lọc');

      setBrands(Array.isArray(result.brands) ? result.brands : []);
      setColors(Array.isArray(result.colors) ? result.colors : []);
    } catch (requestError) {
      console.error('Failed to load product filters:', requestError);
    }
  }, []);

  const fetchWishlist = useCallback(async () => {
    try {
      const response = await fetch('/api/wishlist', { headers: getAuthHeaders() });
      const result = await response.json();
      if (!response.ok || result?.success !== true) throw new Error('Wishlist API failed');

      const serverIds = (result.data || [])
        .map((item) => Number(item.product_id || item.product?.id))
        .filter(Boolean);
      const guestIds = JSON.parse(localStorage.getItem('guest_wishlist') || '[]')
        .map((item) => Number(item.product_id))
        .filter(Boolean);
      setWishlistIds([...new Set([...serverIds, ...guestIds])]);
    } catch {
      const guestIds = JSON.parse(localStorage.getItem('guest_wishlist') || '[]')
        .map((item) => Number(item.product_id))
        .filter(Boolean);
      setWishlistIds(guestIds);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
    fetchWishlist();
  }, [fetchFilters, fetchWishlist]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const brandFromUrl = searchParams.get('brand')?.trim() || '';
    if (brandFromUrl !== selectedBrand) {
      setSelectedBrand(brandFromUrl);
      setCurrentPage(1);
    }
  }, [searchParams, selectedBrand]);

  const updateBrand = (brand) => {
    setSelectedBrand(brand);
    setCurrentPage(1);

    const nextParams = new URLSearchParams(searchParams);
    if (brand) nextParams.set('brand', brand);
    else nextParams.delete('brand');
    setSearchParams(nextParams, { replace: true });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedBrand('');
    setSelectedColor('');
    setSortBy('newest');
    setCurrentPage(1);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('brand');
    setSearchParams(nextParams, { replace: true });
  };

  const handleWishlist = async (product, shouldAdd = true) => {
    const productId = Number(product?.id);
    const token = localStorage.getItem('token');
    if (!productId) throw new Error('Không tìm thấy mã sản phẩm');

    const response = await fetch(
      shouldAdd ? '/api/wishlist/add' : `/api/wishlist/remove/${productId}`,
      {
        method: shouldAdd ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        ...(shouldAdd ? { body: JSON.stringify({ product_id: productId }) } : {}),
      },
    );
    const result = await response.json();

    if (!response.ok || result?.success !== true) {
      throw new Error(result?.error || result?.message || 'Không thể cập nhật yêu thích');
    }

    if (!token) {
      const guestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]');
      const nextWishlist = shouldAdd
        ? [...guestWishlist.filter((item) => Number(item.product_id) !== productId), { product_id: productId, added_at: new Date().toISOString() }]
        : guestWishlist.filter((item) => Number(item.product_id) !== productId);
      localStorage.setItem('guest_wishlist', JSON.stringify(nextWishlist));
    }

    setWishlistIds((previous) => shouldAdd
      ? [...new Set([...previous, productId])]
      : previous.filter((id) => id !== productId));
    window.dispatchEvent(new Event('wishlistUpdated'));
    return { success: true, inWishlist: shouldAdd };
  };

  const changePage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), lastPage);
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="product-list-page">
      <div className="container">
        <h1 className="page-title">Danh Sách Sản Phẩm</h1>

        <div className="product-filters">
          <div className="filter-group">
            <label htmlFor="product-search">Tìm Kiếm</label>
            <input
              id="product-search"
              type="search"
              placeholder="Hãng, model, giá, tỷ lệ..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="brand-filter">Hãng Xe</label>
            <select id="brand-filter" value={selectedBrand} onChange={(event) => updateBrand(event.target.value)}>
              <option value="">Tất Cả Hãng</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="color-filter">Màu Sắc</label>
            <select
              id="color-filter"
              value={selectedColor}
              onChange={(event) => {
                setSelectedColor(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Tất Cả Màu</option>
              {colors.map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-filter">Sắp Xếp</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="newest">Mới Nhất</option>
              <option value="price-low">Giá Thấp Đến Cao</option>
              <option value="price-high">Giá Cao Đến Thấp</option>
              <option value="popular">Bán Chạy Nhất</option>
            </select>
          </div>

          <button type="button" className="reset-btn" onClick={resetFilters}>Xóa Bộ Lọc</button>
        </div>

        {error && <div className="error-message">Lỗi: {error}</div>}

        <div className="products-count">
          Tổng cộng {totalProducts} sản phẩm
          {!loading && ` (đang hiển thị ${products.length} sản phẩm trên trang này)`}
        </div>

        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: PER_PAGE }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : products.length > 0 ? (
          <div className="products-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToWishlist={handleWishlist}
                initialWishlisted={wishlistIds.includes(Number(product.id))}
              />
            ))}
          </div>
        ) : !error && (
          <div className="no-products">
            <div className="empty-icon">📦</div>
            <h3>Không tìm thấy sản phẩm</h3>
            <p>Thử thay đổi bộ lọc để tìm sản phẩm phù hợp.</p>
            <button type="button" onClick={resetFilters} className="btn-reset-filters">Đặt lại bộ lọc</button>
          </div>
        )}

        {!loading && !error && lastPage > 1 && (
          <nav className="product-pagination" aria-label="Phân trang sản phẩm">
            <button type="button" onClick={() => changePage(1)} disabled={currentPage === 1} aria-label="Trang đầu">⏮</button>
            <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} aria-label="Trang trước">◀</button>
            <span>Trang {currentPage} / {lastPage}</span>
            <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === lastPage} aria-label="Trang sau">▶</button>
            <button type="button" onClick={() => changePage(lastPage)} disabled={currentPage === lastPage} aria-label="Trang cuối">⏭</button>
          </nav>
        )}
      </div>
    </div>
  );
}

export default ProductListPage;
