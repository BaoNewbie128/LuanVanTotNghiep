import { useState, useEffect, useCallback, useMemo } from 'react';
import ProductCard from '../components/ProductCard';
import './ProductsPage.css';

function ProductsPage() {
  const [products, setProducts] = useState([]);
  // const [filteredProducts, setFilteredProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [priceRange, setPriceRange] = useState([0, 500000]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products');
      const result = await response.json();
      setProducts(result.data);
      // setFilteredProducts(data);
      
      // Extract unique brands and colors
      const uniqueBrands = [...new Set(result.data.map(p => p.brand))];
      const uniqueColors = [...new Set(result.data.map(p => p.color))];
      setBrands(uniqueBrands);
      setColors(uniqueColors);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  }, []);

  const applyFilters = useCallback((productsToFilter) => {
    let filtered = productsToFilter;

    // Brand filter
    if (selectedBrand) {
      filtered = filtered.filter(p => p.brand === selectedBrand);
    }

    // Color filter
    if (selectedColor) {
      filtered = filtered.filter(p => p.color === selectedColor);
    }

    // Price range filter
    filtered = filtered.filter(p => 
      p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sorting
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        filtered.sort((a, b) => b.sold_count - a.sold_count);
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }

    return filtered;
  }, [selectedBrand, selectedColor, priceRange, searchTerm, sortBy]);

  const handleResetFilters = () => {
    setSelectedBrand('');
    setSelectedColor('');
    setPriceRange([0, 500000]);
    setSearchTerm('');
    setSortBy('newest');
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(
    () => applyFilters(products),
    [applyFilters, products],
  );

  if (loading) {
    return <div className="loading">Đang tải sản phẩm...</div>;
  }

  return (
    <div className="products-page">
      <div className="products-container">
        {/* Sidebar Filters */}
        <aside className="filters-sidebar">
          <h2>Bộ Lọc</h2>

          {/* Search */}
          <div className="filter-group">
            <label>Tìm Kiếm</label>
            <input
              type="text"
              placeholder="Tên xe, hãng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Brand Filter */}
          <div className="filter-group">
            <label>Hãng Xe</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="filter-select"
            >
              <option value="">Tất Cả Hãng</option>
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          {/* Color Filter */}
          <div className="filter-group">
            <label>Màu Sắc</label>
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="filter-select"
            >
              <option value="">Tất Cả Màu</option>
              {colors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>

          {/* Price Range Filter */}
          <div className="filter-group">
            <label>Khoảng Giá</label>
            <div className="price-range">
              <input
                type="number"
                min="0"
                max="500000"
                value={priceRange[0]}
                onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                className="price-input"
                placeholder="Từ"
              />
              <span>-</span>
              <input
                type="number"
                min="0"
                max="500000"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                className="price-input"
                placeholder="Đến"
              />
            </div>
            <div className="price-display">
              {priceRange[0].toLocaleString('vi-VN')} - {priceRange[1].toLocaleString('vi-VN')} VND
            </div>
          </div>

          {/* Reset Button */}
          <button className="reset-btn" onClick={handleResetFilters}>
            Xóa Bộ Lọc
          </button>
        </aside>

        {/* Products Grid */}
        <main className="products-main">
          {/* Sort Options */}
          <div className="sort-bar">
            <span>Sắp xếp theo:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="newest">Mới Nhất</option>
              <option value="price-low">Giá Thấp Đến Cao</option>
              <option value="price-high">Giá Cao Đến Thấp</option>
              <option value="popular">Bán Chạy Nhất</option>
            </select>
            <span className="product-count">
              Tìm thấy {filteredProducts.length} sản phẩm
            </span>
          </div>

          {/* Products Grid */}
          {filteredProducts.length > 0 ? (
            <div className="products-grid">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="no-products">
              <p>Không tìm thấy sản phẩm phù hợp</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default ProductsPage;
