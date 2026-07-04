import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import '../../styles/StaffInventoryPage.css';

const getProductImagePath = (imageName) => {
  if (!imageName || typeof imageName !== 'string') {
    return '/images/ryosuke.jpg';
  }

  if (imageName.startsWith('/') || imageName.startsWith('http://') || imageName.startsWith('https://')) {
    return imageName;
  }

  if (imageName.includes('/')) return `/storage/${imageName}`;

  return `/images/${imageName}`;
};

const stockFilters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'low', label: 'Sắp hết hàng' },
  { key: 'medium', label: 'Tồn kho trung bình' },
  { key: 'high', label: 'Tồn kho ổn định' },
];

const stockStatusLabels = {
  low: 'Sắp hết hàng',
  medium: 'Tồn kho trung bình',
  high: 'Tồn kho ổn định',
};

const defaultMovementForm = {
  type: 'import',
  productId: '',
  quantity: 1,
  importPrice: '',
  note: '',
};

const excelTemplateColumns = ['ma_san_pham', 'so_luong', 'nguong_canh_bao'];

function StaffInventoryPage() {
  const [products, setProducts] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [movements, setMovements] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    brands: [],
    colors: [],
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    from: 0,
    to: 0,
    total: 0,
  });
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [movementForm, setMovementForm] = useState(defaultMovementForm);
  const [submitting, setSubmitting] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelSubmitting, setExcelSubmitting] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productPickerSearch, setProductPickerSearch] = useState('');
  const productPickerRef = useRef(null);

  const fetchStock = useCallback(async (page) => {
    const token = localStorage.getItem('token');

    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [stockResponse, movementResponse] = await Promise.all([
        axios.get('/api/staff/stock', {
          params: {
            page,
            threshold: 5,
            search: searchTerm.trim(),
            brand: selectedBrand,
            color: selectedColor,
            stock_status: activeFilter === 'all' ? '' : activeFilter,
          },
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/staff/stock/movements', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const payload = stockResponse.data?.data;
      setProducts(payload?.data || []);
      setFilterOptions({
        brands: stockResponse.data?.filters?.brands || [],
        colors: stockResponse.data?.filters?.colors || [],
      });
      setPagination({
        currentPage: payload?.current_page || 1,
        lastPage: payload?.last_page || 1,
        from: payload?.from || 0,
        to: payload?.to || 0,
        total: payload?.total || 0,
      });
      setMovements(movementResponse.data?.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải dữ liệu tồn kho.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchTerm, selectedBrand, selectedColor]);

  useEffect(() => {
    fetchStock(pagination.currentPage);
  }, [fetchStock, pagination.currentPage]);

  useEffect(() => {
    const fetchProductOptions = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await axios.get('/api/staff/stock/products', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProductOptions(response.data?.data || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Không thể tải đầy đủ danh sách sản phẩm.');
      }
    };

    fetchProductOptions();
  }, []);

  useEffect(() => {
    if (!productPickerOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (productPickerRef.current && !productPickerRef.current.contains(event.target)) {
        setProductPickerOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setProductPickerOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [productPickerOpen]);

  const brandOptions = useMemo(
    () => filterOptions.brands,
    [filterOptions.brands],
  );

  const colorOptions = useMemo(
    () => filterOptions.colors,
    [filterOptions.colors],
  );

  const filteredProducts = useMemo(() => products, [products]);

  const selectedMovementProduct = useMemo(
    () => productOptions.find((product) => Number(product.id) === Number(movementForm.productId)) || null,
    [movementForm.productId, productOptions],
  );

  const filteredProductOptions = useMemo(() => {
    const keywords = productPickerSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return productOptions;

    return productOptions.filter((product) => {
      const searchable = [product.id, product.brand, product.model, product.color, product.scale]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();
      return keywords.every((keyword) => searchable.includes(keyword));
    });
  }, [productOptions, productPickerSearch]);

  const summary = useMemo(() => ({
    total: products.length,
    low: products.filter((product) => product.stock_status === 'low').length,
    medium: products.filter((product) => product.stock_status === 'medium').length,
    high: products.filter((product) => product.stock_status === 'high').length,
  }), [products]);

  const goToPage = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  const applyFilterChange = (updater) => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    updater();
  };

  const resetFilters = () => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setActiveFilter('all');
    setSelectedBrand('');
    setSelectedColor('');
    setSearchTerm('');
  };

  const submitMovement = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    if (!movementForm.productId) {
      setError('Vui lòng chọn sản phẩm cần nhập hoặc xuất kho.');
      setProductPickerOpen(true);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        note: movementForm.note,
        items: [
          {
            product_id: Number(movementForm.productId),
            quantity: Number(movementForm.quantity),
            ...(movementForm.type === 'import'
              ? { import_price: Number(movementForm.importPrice || 0) }
              : {}),
          },
        ],
      };

      const endpoint = movementForm.type === 'import'
        ? '/api/staff/stock/import'
        : '/api/staff/stock/export';

      await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setMovementForm(defaultMovementForm);
      setProductPickerSearch('');
      setProductPickerOpen(false);
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
      await fetchStock(1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể lưu phiếu nhập/xuất kho.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitExcelImport = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem('token');
    if (!token || !excelFile) {
      setError('Vui lòng chọn tệp Excel hợp lệ để nhập dữ liệu.');
      return;
    }

    setExcelSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', excelFile);

      await axios.post('/api/staff/stock/import-excel', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setExcelFile(null);
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
      await fetchStock(1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể nhập dữ liệu từ Excel.');
    } finally {
      setExcelSubmitting(false);
    }
  };

  return (
    <section className="staff-inventory-page">
      <div className="staff-inventory-page__intro">
        <div>
          <h2>Theo dõi tồn kho</h2>
          <p>
            Bảng điều khiển tồn kho dành cho nhân viên giúp theo dõi số lượng thực tế, cảnh báo
            hàng sắp hết và tạo phiếu nhập/xuất kho có lưu chứng từ.
          </p>
        </div>
        <div className="staff-inventory-page__meta">Giai đoạn 2.2</div>
      </div>

      <div className="staff-inventory-summary">
        <article className="staff-inventory-summary__card">
          <span>Sản phẩm hiển thị</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="staff-inventory-summary__card staff-inventory-summary__card--low">
          <span>Sắp hết hàng</span>
          <strong>{summary.low}</strong>
        </article>
        <article className="staff-inventory-summary__card staff-inventory-summary__card--medium">
          <span>Tồn kho trung bình</span>
          <strong>{summary.medium}</strong>
        </article>
        <article className="staff-inventory-summary__card staff-inventory-summary__card--high">
          <span>Tồn kho ổn định</span>
          <strong>{summary.high}</strong>
        </article>
      </div>

      <form className="staff-stock-form" onSubmit={submitMovement}>
        <div className="staff-stock-form__header">
          <div>
            <h3>Phiếu nhập / xuất kho</h3>
            <p>Tạo chứng từ kho và cập nhật số lượng sản phẩm bằng giao dịch phía máy chủ.</p>
          </div>
        </div>

        <div className="staff-stock-form__grid">
          <label>
            <span>Loại phiếu</span>
            <select
              value={movementForm.type}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="import">Phiếu nhập</option>
              <option value="export">Phiếu xuất</option>
            </select>
          </label>

          <div className="staff-stock-form__field">
            <span>Sản phẩm</span>
            <div className="staff-product-picker" ref={productPickerRef}>
              <button
                type="button"
                className={`staff-product-picker__trigger${productPickerOpen ? ' staff-product-picker__trigger--open' : ''}`}
                onClick={() => setProductPickerOpen((isOpen) => !isOpen)}
                aria-haspopup="listbox"
                aria-expanded={productPickerOpen}
              >
                {selectedMovementProduct ? (
                  <>
                    <img
                      src={getProductImagePath(selectedMovementProduct.image)}
                      alt=""
                      onError={(event) => { event.currentTarget.src = '/images/ryosuke.jpg'; }}
                    />
                    <span className="staff-product-picker__selected-text">
                      <strong>#{selectedMovementProduct.id} - {selectedMovementProduct.brand} {selectedMovementProduct.model}</strong>
                      <small>{selectedMovementProduct.color} · {selectedMovementProduct.scale}</small>
                    </span>
                  </>
                ) : (
                  <span className="staff-product-picker__placeholder">Chọn sản phẩm ({productOptions.length} sản phẩm)</span>
                )}
                <span className="staff-product-picker__chevron" aria-hidden="true">▾</span>
              </button>

              {productPickerOpen && (
                <div className="staff-product-picker__menu">
                  <div className="staff-product-picker__search">
                    <input
                      type="search"
                      value={productPickerSearch}
                      onChange={(event) => setProductPickerSearch(event.target.value)}
                      placeholder="Tìm theo mã, hãng, model, màu, tỷ lệ..."
                      autoFocus
                    />
                  </div>
                  <div className="staff-product-picker__options" role="listbox">
                    {filteredProductOptions.length > 0 ? filteredProductOptions.map((product) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={Number(movementForm.productId) === Number(product.id)}
                        className={`staff-product-picker__option${Number(movementForm.productId) === Number(product.id) ? ' staff-product-picker__option--selected' : ''}`}
                        key={product.id}
                        onClick={() => {
                          setMovementForm((previous) => ({ ...previous, productId: String(product.id) }));
                          setProductPickerOpen(false);
                          setProductPickerSearch('');
                        }}
                      >
                        <img
                          src={getProductImagePath(product.image)}
                          alt=""
                          loading="lazy"
                          onError={(event) => { event.currentTarget.src = '/images/ryosuke.jpg'; }}
                        />
                        <span>
                          <strong>#{product.id} - {product.brand} {product.model}</strong>
                          <small>{product.color} · {product.scale} · Tồn: {product.stock}</small>
                        </span>
                      </button>
                    )) : (
                      <div className="staff-product-picker__empty">Không tìm thấy sản phẩm phù hợp.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <label>
            <span>Số lượng</span>
            <input
              type="number"
              min="1"
              value={movementForm.quantity}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))}
              required
            />
          </label>

          {movementForm.type === 'import' && (
            <label>
              <span>Giá nhập</span>
              <input
                type="number"
                min="0"
                value={movementForm.importPrice}
                onChange={(event) => setMovementForm((prev) => ({ ...prev, importPrice: event.target.value }))}
                required
              />
            </label>
          )}

          <label className="staff-stock-form__full">
            <span>Ghi chú</span>
            <textarea
              rows="3"
              value={movementForm.note}
              onChange={(event) => setMovementForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Ví dụ: nhập thêm hàng tháng 7 / xuất hỏng vỡ / kiểm kê kho..."
            />
          </label>
        </div>

        <div className="staff-stock-form__actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Đang lưu chứng từ...' : 'Lưu phiếu kho'}
          </button>
        </div>
      </form>

      <form className="staff-stock-form staff-stock-form--excel" onSubmit={submitExcelImport}>
        <div className="staff-stock-form__header">
          <div>
            <h3>Nhập tồn kho từ Excel</h3>
            <p>
              Tải file `.xlsx`, `.xls` hoặc `.csv` với cột tiếng Việt hóa: {excelTemplateColumns.join(', ')}.
            </p>
          </div>
        </div>

        <div className="staff-stock-form__grid">
          <label className="staff-stock-form__full">
            <span>Chọn tệp Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => setExcelFile(event.target.files?.[0] || null)}
              required
            />
          </label>
        </div>

        <div className="staff-stock-form__actions">
          <button type="submit" disabled={excelSubmitting}>
            {excelSubmitting ? 'Đang nhập dữ liệu Excel...' : 'Nhập dữ liệu Excel'}
          </button>
        </div>
      </form>

      <div className="staff-inventory-toolbar">
        <div className="staff-inventory-search-panel">
          <div className="staff-inventory-search-panel__field staff-inventory-search-panel__field--search">
            <label htmlFor="staff-inventory-search">Tìm kiếm sản phẩm</label>
            <input
              id="staff-inventory-search"
              type="text"
              value={searchTerm}
              onChange={(event) => applyFilterChange(() => setSearchTerm(event.target.value))}
              placeholder="Tìm theo tên xe, hãng, màu sắc hoặc mã sản phẩm..."
            />
          </div>

          <div className="staff-inventory-search-panel__field">
            <label htmlFor="staff-inventory-brand">Hãng xe</label>
            <select
              id="staff-inventory-brand"
              value={selectedBrand}
              onChange={(event) => applyFilterChange(() => setSelectedBrand(event.target.value))}
            >
              <option value="">Tất cả hãng</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div className="staff-inventory-search-panel__field">
            <label htmlFor="staff-inventory-color">Màu sắc</label>
            <select
              id="staff-inventory-color"
              value={selectedColor}
              onChange={(event) => applyFilterChange(() => setSelectedColor(event.target.value))}
            >
              <option value="">Tất cả màu</option>
              {colorOptions.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>

          <button type="button" className="staff-inventory-search-panel__reset" onClick={resetFilters}>
            Xóa lọc
          </button>
        </div>

        <div className="staff-inventory-filters">
          {stockFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`staff-inventory-filter${activeFilter === filter.key ? ' staff-inventory-filter--active' : ''}`}
              onClick={() => applyFilterChange(() => setActiveFilter(filter.key))}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="staff-inventory-empty">Đang tải dashboard tồn kho...</div>}
      {!loading && error && <div className="staff-inventory-feedback">{error}</div>}
      {!loading && !error && filteredProducts.length === 0 && (
        <div className="staff-inventory-empty">Không có sản phẩm phù hợp với bộ lọc tồn kho.</div>
      )}

      {!loading && !error && filteredProducts.length > 0 && (
        <>
          <div className="staff-inventory-table-wrapper">
            <table className="staff-inventory-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Biến thể</th>
                  <th>Tồn kho</th>
                  <th>Ngưỡng cảnh báo</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={product.stock_status === 'low' ? 'staff-inventory-table__row--low' : ''}
                  >
                    <td>
                      <div className="staff-inventory-product">
                         <img
                           src={getProductImagePath(product.image)}
                           alt={`${product.brand} ${product.model}`}
                           className="staff-inventory-product__image"
                         />
                         <div className="staff-inventory-product__content">
                        <strong>{product.brand} {product.model}</strong>
                        <span>#{product.id}</span>
                         </div>
                      </div>
                    </td>
                    <td>
                      <div className="staff-inventory-variant">
                        <span>Tỷ lệ: {product.scale}</span>
                        <span>Màu sắc: {product.color}</span>
                      </div>
                    </td>
                    <td><strong>{product.stock}</strong></td>
                    <td>{product.low_stock_threshold ?? 5}</td>
                    <td>
                      <span className={`staff-inventory-status staff-inventory-status--${product.stock_status}`}>
                        {stockStatusLabels[product.stock_status] || product.stock_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="staff-inventory-pagination">
            <span>
              Hiển thị {pagination.from} - {pagination.to} / {pagination.total} sản phẩm
            </span>

            <div className="staff-inventory-pagination__buttons">
              <button
                type="button"
                onClick={() => goToPage(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={() => goToPage(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.lastPage}
              >
                Trang sau
              </button>
            </div>
          </div>
        </>
      )}

      <section className="staff-stock-history">
        <div className="staff-stock-history__header">
          <h3>Lịch sử phiếu kho</h3>
          <p>Hiển thị cả phiếu nhập và phiếu xuất, ưu tiên mới nhất trước.</p>
        </div>

        {movements.length === 0 ? (
          <div className="staff-inventory-empty">Chưa có chứng từ kho nào được ghi nhận.</div>
        ) : (
          <div className="staff-stock-history__list">
            {movements.map((movement) => (
              <article key={`${movement.type}-${movement.id}`} className="staff-stock-history__card">
                <div className="staff-stock-history__card-header">
                  <div>
                    <h4>
                      {movement.type === 'import' ? 'Phiếu nhập' : 'Phiếu xuất'} #{movement.id}
                    </h4>
                    <p>{movement.created_at ? new Date(movement.created_at).toLocaleString('vi-VN') : 'Không có'}</p>
                  </div>
                  <span className={`staff-stock-history__badge staff-stock-history__badge--${movement.type}`}>
                    {movement.type === 'import' ? 'Nhập kho' : 'Xuất kho'}
                  </span>
                </div>

                <p className="staff-stock-history__note">{movement.note || 'Không có ghi chú.'}</p>

                <ul className="staff-stock-history__items">
                  {(movement.items || []).map((item, index) => (
                    <li key={`${movement.type}-${movement.id}-${index}`}>
                      {item.product?.brand} {item.product?.model} × {item.quantity}
                      {movement.type === 'import' && item.import_price !== undefined
                        ? ` · Giá nhập: ${Number(item.import_price).toLocaleString('vi-VN')} VND`
                        : ''}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default StaffInventoryPage;
