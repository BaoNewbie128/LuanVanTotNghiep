import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const api = import.meta.env.VITE_API_BASE_URL || '/api';
const fallbackImage = '/images/ryosuke.jpg';

const brandLogoPaths = {
  honda: '/images/logo/honda_logo.jpg',
  mazda: '/images/logo/Mazda_Logo.png',
  mitsubishi: '/images/logo/mitsubishi_logo.png',
  nissan: '/images/logo/nissan_logo.jpg',
  subaru: '/images/logo/subaru_logo.jpg',
  toyota: '/images/logo/toyota_logo.jpg',
};

const getBrandLogo = (brand) => brandLogoPaths[String(brand || '').trim().toLowerCase()] || fallbackImage;

const getProductImage = (product) => {
  if (product?.primary_image_url) {
    return product.primary_image_url;
  }

  if (!product?.image) {
    return fallbackImage;
  }

  const image = String(product.image);
  return image.startsWith('/') ? image : image.includes('/') ? `/storage/${image}` : `/images/${image}`;
};

const useFallbackImage = (event) => {
  if (!event.currentTarget.src.endsWith(fallbackImage)) {
    event.currentTarget.src = fallbackImage;
  }
};

const initialProductForm = {
  brand: '',
  model: '',
  scale: '1:32',
  low_stock_threshold: 5,
  description: '',
  is_active: true,
  variants: [{ color: '', price: '', stock: '', image: null }],
  image: null,
  images: [],
  removed_image_ids: [],
};

const createEmptyVariant = () => ({ color: '', price: '', stock: '', image: null });

const initialBrandForm = {
  name: '',
};

const PRODUCT_PRICE_MIN = 100000;
const PRODUCT_PRICE_MAX = 10000000;
const namePattern = /^[\p{L}\s0-9-]+$/u;
const modelPattern = /^[\p{L}\s0-9:-]+$/u;

function VietnameseFileInput({ multiple = false, onChange }) {
  const inputId = useId();
  const [fileNames, setFileNames] = useState('');

  const handleChange = (event) => {
    setFileNames(Array.from(event.target.files || []).map((file) => file.name).join(', '));
    onChange(event);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <label htmlFor={inputId} style={{ ...secondaryButtonStyle, display: 'inline-block' }}>Chọn tệp ảnh</label>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{fileNames || 'Chưa chọn tệp ảnh'}</span>
      <input id={inputId} type="file" accept=".jpeg,.jpg,.png" multiple={multiple} onChange={handleChange} style={{ display: 'none' }} />
    </div>
  );
}

const validateProductForm = (form, editingProductId = null) => {
  if (!form.brand.trim()) {
    return 'Vui lòng chọn hoặc nhập hãng xe.';
  }

  if (!namePattern.test(form.brand.trim())) {
    return 'Hãng xe chỉ được chứa chữ, số, khoảng trắng và dấu gạch ngang.';
  }

  if (!form.model.trim() || !modelPattern.test(form.model.trim())) {
    return 'Model chỉ được chứa chữ, số, khoảng trắng, dấu gạch ngang và dấu hai chấm.';
  }

  const variants = form.variants?.length ? form.variants : [createEmptyVariant()];

  for (const [index, variant] of variants.entries()) {
    const price = Number(variant.price);
    if (!Number.isFinite(price) || price < PRODUCT_PRICE_MIN || price > PRODUCT_PRICE_MAX) {
      return `Giá biến thể #${index + 1} phải từ 100.000 đến 10.000.000 VND.`;
    }

    if (!variant.color.trim() || !namePattern.test(variant.color.trim())) {
      return `Màu sắc biến thể #${index + 1} không được chứa ký tự đặc biệt.`;
    }

    const stock = Number(variant.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return `Tồn kho biến thể #${index + 1} phải là số nguyên không âm.`;
    }

    if (!editingProductId && !variant.image) {
      return `Ảnh biến thể #${index + 1} là bắt buộc.`;
    }
  }

  const lowStockThreshold = Number(form.low_stock_threshold);
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 1) {
    return 'Ngưỡng cảnh báo tồn kho phải là số nguyên tối thiểu là 1.';
  }

  if (!form.description.trim()) {
    return 'Mô tả sản phẩm là bắt buộc.';
  }

  if (editingProductId && !form.image && !form.existing_primary_image) {
    return 'Ảnh đại diện sản phẩm là bắt buộc.';
  }

  return '';
};

const appendVariantPayload = (payload, variants) => {
  variants.forEach((variant, index) => {
    payload.append(`variants[${index}][color]`, variant.color.trim());
    payload.append(`variants[${index}][price]`, String(variant.price).trim());
    payload.append(`variants[${index}][stock]`, String(variant.stock).trim());

    if (variant.image) {
      payload.append(`variants[${index}][image]`, variant.image);
    }
  });
};

const appendCreateProductPayload = (payload, form) => {
  ['brand', 'model', 'scale', 'description'].forEach((key) => {
    payload.append(key, form[key].trim());
  });

  appendVariantPayload(payload, form.variants);
};

function AdminCatalogPage() {
  const navigate = useNavigate();
  const productFormRef = useRef(null);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [brandForm, setBrandForm] = useState(initialBrandForm);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingBrandId, setEditingBrandId] = useState(null);
  const [productFilters, setProductFilters] = useState({ search: '', status: 'all', brand: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const groupedProducts = Object.values(
    products.reduce((groups, product) => {
      const groupKey = [product.brand, product.model, product.scale, product.description].join('::');

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          representativeId: product.id,
          brand: product.brand,
          model: product.model,
          scale: product.scale,
          description: product.description,
          deleted_at: product.deleted_at,
          is_active: product.is_active,
          isDeleted: Boolean(product.deleted_at),
          variants: [],
        };
      }

      groups[groupKey].deleted_at = groups[groupKey].deleted_at || product.deleted_at;
      groups[groupKey].is_active = groups[groupKey].is_active && Boolean(product.is_active);
      groups[groupKey].isDeleted = groups[groupKey].isDeleted || Boolean(product.deleted_at);

      groups[groupKey].variants.push(product);

      return groups;
    }, {})
  );

  const handleRequestError = useCallback((requestError, fallbackMessage) => {
    const redirectTo = requestError.response?.data?.redirect_to;

    if (requestError.response?.status === 403 && redirectTo) {
      navigate(redirectTo, { replace: true });
      return;
    }

    setError(requestError.response?.data?.message || fallbackMessage);
  }, [navigate]);

  const loadData = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setProductsLoading(true);
    setError('');
    const requestHeaders = { Authorization: `Bearer ${token}` };

    try {
      const [brandsResponse, productsResponse] = await Promise.all([
        axios.get(`${api}/admin/brands`, { headers: requestHeaders }),
        axios.get(`${api}/admin/products`, {
          headers: requestHeaders,
          params: {
            page: currentPage,
            search: productFilters.search || undefined,
            status: productFilters.status !== 'all' ? productFilters.status : undefined,
            brand: productFilters.brand || undefined,
          },
        }),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const nextPagination = productsResponse.data?.pagination || null;
      setBrands(brandsResponse.data?.data || []);
      setProducts(productsResponse.data?.data || []);
      setPagination(nextPagination);

      if (nextPagination && currentPage > nextPagination.last_page) {
        setCurrentPage(Math.max(nextPagination.last_page, 1));
      }
    } catch (requestError) {
      if (requestId === requestIdRef.current) {
        handleRequestError(requestError, 'Không thể tải dữ liệu danh mục.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        hasLoadedRef.current = true;
        setLoading(false);
        setProductsLoading(false);
      }
    }
  }, [currentPage, handleRequestError, productFilters, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    loadData();
  }, [loadData, navigate, token]);

  const updateProductFilter = (key, value) => {
    setProductFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  };

  const toggleRemovedGalleryImage = (imageId) => {
    setProductForm((current) => {
      const removed = current.removed_image_ids.includes(imageId)
        ? current.removed_image_ids.filter((id) => id !== imageId)
        : [...current.removed_image_ids, imageId];

      return { ...current, removed_image_ids: removed };
    });
  };

  const updateVariant = (index, field, value) => {
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) => (
        variantIndex === index ? { ...variant, [field]: value } : variant
      )),
    }));
  };

  const addVariant = () => {
    setProductForm((current) => ({
      ...current,
      variants: [...current.variants, createEmptyVariant()],
    }));
  };

  const removeVariant = (index) => {
    setProductForm((current) => {
      if (current.variants.length <= 1) {
        return current;
      }

      return {
        ...current,
        variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
      };
    });
  };

  const resetBrandForm = () => {
    setBrandForm(initialBrandForm);
    setEditingBrandId(null);
  };

  const handleBrandSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const brandName = brandForm.name.trim();

    if (!brandName) {
      setError('Vui lòng nhập tên danh mục/hãng xe.');
      return;
    }

    if (!namePattern.test(brandName)) {
      setError('Tên danh mục chỉ được chứa chữ, số, khoảng trắng và dấu gạch ngang.');
      return;
    }

    try {
      await axios.put(`${api}/admin/brands/${encodeURIComponent(editingBrandId)}`, { name: brandName }, { headers });
      setMessage('Đã cập nhật hãng xe.');

      resetBrandForm();
      if (editingProductId) {
        setProductForm((current) => ({ ...current, brand: brandName }));
      }
      loadData();
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể lưu danh mục/hãng xe.');
    }
  };

  const startEditBrand = (brand) => {
    setMessage('');
    setError('');
    setEditingBrandId(brand.name);
    setBrandForm({ name: brand.name });
  };

  const removeBrand = async (brand) => {
    if (!window.confirm(`Bạn có chắc muốn xóa danh mục/hãng "${brand.name}"? Tất cả sản phẩm thuộc nhóm này sẽ bị xóa mềm.`)) {
      return;
    }

    setMessage('');
    setError('');

    try {
      const response = await axios.delete(`${api}/admin/brands/${encodeURIComponent(brand.name)}`, { headers });
      setMessage(response.data?.message || 'Đã xóa danh mục/hãng xe.');

      if (editingBrandId === brand.name) {
        resetBrandForm();
      }

      if (productFilters.brand === brand.name) {
        setProductFilters((current) => ({ ...current, brand: '' }));
      }

      if (productForm.brand === brand.name) {
        setProductForm((current) => ({ ...current, brand: '' }));
      }

      loadData();
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể xóa danh mục/hãng xe.');
    }
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const validationError = validateProductForm(productForm, editingProductId);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const payload = new FormData();

      if (!editingProductId) {
        appendCreateProductPayload(payload, productForm);
      } else {
        Object.entries(productForm).forEach(([key, value]) => {
          if (key === 'variants') {
            const variant = value?.[0] || {};
            payload.append('color', variant.color || '');
            payload.append('price', variant.price || '');
            payload.append('stock', variant.stock || '');
            if (variant.image) {
              payload.append('image', variant.image);
            }
            return;
          }

          if (key === 'images') {
            Array.from(value || []).forEach((file) => payload.append('images[]', file));
            return;
          }

          if (key === 'removed_image_ids') {
            value.forEach((imageId) => payload.append('removed_image_ids[]', imageId));
            return;
          }

          if (value === null || value === undefined || key === 'existing_primary_image' || key === 'existing_gallery') {
            return;
          }

          if (key === 'is_active') {
            payload.append(key, value ? '1' : '0');
            return;
          }

          payload.append(key, typeof value === 'string' ? value.trim() : value);
        });
      }

      if (editingProductId) {
        payload.append('_method', 'PUT');
        await axios.post(`${api}/admin/products/${editingProductId}`, payload, { headers });
        setMessage('Đã cập nhật sản phẩm.');
      } else {
        await axios.post(`${api}/admin/products`, payload, { headers });
        setMessage('Đã tạo sản phẩm.');
        setProductForm({
          ...initialProductForm,
          variants: [createEmptyVariant()],
        });
      }

      setProductForm(initialProductForm);
      setEditingProductId(null);
      loadData();
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể lưu sản phẩm.');
    }
  };

  const startEditProduct = (product) => {
    setMessage('');
    setError('');
    setEditingProductId(product.id);
    setProductForm({
      brand: product.brand || '',
      model: product.model || '',
      scale: product.scale || '1:32',
      low_stock_threshold: product.low_stock_threshold || 5,
      description: product.description || '',
      is_active: Boolean(product.is_active),
      variants: [{ color: product.color || '', price: product.price || '', stock: product.stock || '', image: null }],
      image: null,
      images: [],
      removed_image_ids: [],
      existing_primary_image: product.primary_image_url || null,
      existing_image_name: product.image || '',
      existing_gallery: product.gallery || [],
    });

    window.requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const removeProduct = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa nhóm sản phẩm này? Tất cả biến thể của mẫu xe sẽ bị xóa mềm.')) {
      return;
    }

    setMessage('');
    setError('');

    try {
      const response = await axios.delete(`${api}/admin/products/${id}`, { headers });
      setMessage(response.data?.message || 'Đã cập nhật sản phẩm.');
      if (editingProductId === id) {
        setEditingProductId(null);
        setProductForm(initialProductForm);
      }
      loadData();
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể xóa sản phẩm.');
    }
  };

  return (
    <div className="admin-legacy-page" style={{ maxWidth: 1280, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 12 }}>Quản lý danh mục sản phẩm</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Dữ liệu hãng xe và sản phẩm được đọc trực tiếp từ cơ sở dữ liệu.
      </p>

      {message && <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: '#ecfdf5', color: '#166534' }}>{message}</div>}
      {error && <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      {loading ? (
        <div>Đang tải...</div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          <section style={sectionStyle}>
            <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)' }}>
              <form ref={productFormRef} onSubmit={handleProductSubmit} style={{ padding: 20, border: '1px solid #e5e7eb', borderRadius: 16, background: '#fff' }}>
                <h2>{editingProductId ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm'}</h2>
                <h3 style={{ marginBottom: 12 }}>Phần 1 - Thông tin chung</h3>
                <input
                  list="admin-catalog-brand-options"
                  value={productForm.brand}
                  onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                  placeholder="Chọn hãng có sẵn hoặc nhập hãng mới"
                  style={inputStyle}
                />
                <datalist id="admin-catalog-brand-options">
                  {brands.map((brand) => (
                    <option key={brand.id || brand.name} value={brand.name} />
                  ))}
                </datalist>
                <input value={productForm.model} onChange={(e) => setProductForm({ ...productForm, model: e.target.value })} placeholder="Tên mẫu xe" style={inputStyle} />
                <input value={productForm.scale} onChange={(e) => setProductForm({ ...productForm, scale: e.target.value })} placeholder="Tỷ lệ" style={inputStyle} />
                {editingProductId && (
                  <input type="number" value={productForm.low_stock_threshold} onChange={(e) => setProductForm({ ...productForm, low_stock_threshold: e.target.value })} placeholder="Ngưỡng cảnh báo sắp hết hàng" style={inputStyle} />
                )}
                <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Mô tả sản phẩm" style={{ ...inputStyle, minHeight: 96 }} />

                <h3 style={{ margin: '18px 0 12px' }}>Phần 2 - Biến thể sản phẩm</h3>
                {productForm.variants.map((variant, index) => (
                  <div key={index} style={variantCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                      <strong>Biến thể #{index + 1}</strong>
                      {!editingProductId && productForm.variants.length > 1 && (
                        <button type="button" onClick={() => removeVariant(index)} style={dangerButtonStyle}>Xóa</button>
                      )}
                    </div>
                    <input value={variant.color} onChange={(e) => updateVariant(index, 'color', e.target.value)} placeholder="Màu sắc" style={inputStyle} />
                    <input type="number" value={variant.price} onChange={(e) => updateVariant(index, 'price', e.target.value)} placeholder="Giá bán" style={inputStyle} />
                    <input type="number" value={variant.stock} onChange={(e) => updateVariant(index, 'stock', e.target.value)} placeholder="Tồn kho" style={inputStyle} />
                    <VietnameseFileInput onChange={(e) => updateVariant(index, 'image', e.target.files?.[0] || null)} />
                    {variant.image && (
                      <img src={URL.createObjectURL(variant.image)} alt={`Biến thể ${index + 1}`} style={thumbnailStyle} />
                    )}
                  </div>
                ))}
                {!editingProductId && (
                  <button type="button" onClick={addVariant} style={{ ...secondaryButtonStyle, marginBottom: 16 }}>+ Thêm biến thể</button>
                )}

                {editingProductId && (
                  <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ ...labelStyle, display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    Ảnh đại diện sản phẩm
                  </label>
                  <VietnameseFileInput onChange={(e) => setProductForm({ ...productForm, image: e.target.files?.[0] || null })} />
                  <small style={{ color: '#6b7280' }}>
                    Dùng làm ảnh chính hiển thị trên thẻ sản phẩm và phần xem trước mặc định.
                  </small>
                </div>

                  </>
                )}

                {editingProductId && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ ...labelStyle, display: 'block', marginBottom: 6, fontWeight: 600 }}>
                        Bộ sưu tập ảnh (nhiều ảnh)
                      </label>
                      <VietnameseFileInput multiple onChange={(e) => setProductForm({ ...productForm, images: e.target.files || [] })} />
                      <small style={{ color: '#6b7280' }}>
                        Có thể chọn nhiều ảnh để hiển thị bổ sung trong chi tiết sản phẩm.
                      </small>
                    </div>

                    {(productForm.image || productForm.existing_primary_image || productForm.existing_image_name) && (
                      <div style={{ marginBottom: 12 }}>
                        <strong>Ảnh đại diện hiện tại:</strong>
                        <div>
                          <img
                            src={
                              productForm.image
                                ? URL.createObjectURL(productForm.image)
                                : (productForm.existing_image_name
                                    ? `/images/${productForm.existing_image_name}`
                                    : productForm.existing_primary_image)
                            }
                            alt="Ảnh đại diện"
                            style={galleryImageStyle}
                          />
                        </div>
                      </div>
                    )}

                    {productForm.existing_gallery?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <strong>Bộ sưu tập ảnh hiện tại:</strong>
                        <div style={galleryGridStyle}>
                          {productForm.existing_gallery.map((image) => (
                            <div key={image.id} style={galleryItemStyle}>
                              <img src={image.full_url} alt="Ảnh trong bộ sưu tập" style={galleryImageStyle} />
                              <label style={labelStyle}>
                                <input
                                  type="checkbox"
                                  checked={productForm.removed_image_ids.includes(image.id)}
                                  onChange={() => toggleRemovedGalleryImage(image.id)}
                                />
                                Xóa ảnh
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <label style={labelStyle}>
                      <input type="checkbox" checked={Boolean(productForm.is_active)} onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })} />
                      Sản phẩm đang hoạt động
                    </label>
                  </>
                )}
                <div style={buttonRowStyle}>
                  <button type="submit" style={primaryButtonStyle}>{editingProductId ? 'Cập nhật sản phẩm' : 'Tạo sản phẩm'}</button>
                  {editingProductId && <button type="button" onClick={() => { setEditingProductId(null); setProductForm({ ...initialProductForm, variants: [createEmptyVariant()] }); }} style={secondaryButtonStyle}>Hủy</button>}
                </div>
              </form>

              <div style={{ padding: 20, border: '1px solid #e5e7eb', borderRadius: 16, background: '#fff' }}>
                <h2>Hãng xe trong sản phẩm</h2>
                {editingBrandId && (
                  <form onSubmit={handleBrandSubmit}>
                    <input
                      value={brandForm.name}
                      onChange={(e) => setBrandForm({ name: e.target.value })}
                      placeholder="Tên hãng xe"
                      style={inputStyle}
                    />
                    <div style={buttonRowStyle}>
                      <button type="submit" style={primaryButtonStyle}>Cập nhật hãng</button>
                      <button type="button" onClick={resetBrandForm} style={secondaryButtonStyle}>Hủy</button>
                    </div>
                  </form>
                )}

                <div style={{ marginTop: 24 }}>
                  <h3>Danh sách hãng xe</h3>
                  {brands.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Chưa có nhóm danh mục nào.</div>
                  ) : (
                    brands.map((brand) => (
                      <div key={brand.id} style={listItemStyle}>
                        <div style={brandIdentityStyle}>
                          <img
                            src={getBrandLogo(brand.name)}
                            alt={`${brand.name} logo`}
                            style={brandLogoStyle}
                            onError={useFallbackImage}
                          />
                          <div>
                            <strong style={{ display: 'block' }}>{brand.name}</strong>
                            <small>{brand.products_count} sản phẩm</small>
                          </div>
                        </div>
                        <div style={buttonRowStyle}>
                          <button type="button" onClick={() => startEditBrand(brand)} style={secondaryButtonStyle}>Sửa</button>
                          <button type="button" onClick={() => removeBrand(brand)} style={dangerButtonStyle}>Xóa</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 16 }}>
              <input value={productFilters.search} onChange={(e) => updateProductFilter('search', e.target.value)} placeholder="Tìm kiếm sản phẩm..." style={inputStyle} />
              <select value={productFilters.status} onChange={(e) => updateProductFilter('status', e.target.value)} style={inputStyle}>
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
                <option value="deleted">Đã xóa mềm</option>
              </select>
              <select value={productFilters.brand} onChange={(e) => updateProductFilter('brand', e.target.value)} style={inputStyle}>
                <option value="">Tất cả hãng xe</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.name}>{brand.name}</option>
                ))}
              </select>
            </div>

            {productsLoading && <div style={filterLoadingStyle}>Đang cập nhật danh sách sản phẩm...</div>}

            {!productsLoading && groupedProducts.length === 0 && (
              <div style={{ color: '#6b7280', padding: '20px 0' }}>Không có sản phẩm phù hợp.</div>
            )}

            {groupedProducts.map((group) => (
              <div key={group.groupKey} style={{ ...groupCardStyle, ...(group.isDeleted ? deletedGroupCardStyle : {}) }}>
                <div>
                  <div style={groupHeaderStyle}>
                    <div style={groupIdentityStyle}>
                      <img
                        src={getProductImage(group.variants[0])}
                        alt={`${group.brand} ${group.model}`}
                        style={groupProductImageStyle}
                        onError={useFallbackImage}
                      />
                      <div>
                        <strong>{group.brand} {group.model}</strong>
                        <div style={{ color: '#666', marginBottom: 6 }}>{group.brand || 'Chưa có hãng'} • {group.scale} • {group.variants.length} biến thể</div>
                        <small>{group.isDeleted ? 'Đã xóa mềm' : (group.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động')}</small>
                      </div>
                    </div>

                    <div style={buttonRowStyle}>
                      <button
                        type="button"
                        onClick={() => removeProduct(group.representativeId)}
                        disabled={group.isDeleted}
                        style={{
                          ...dangerButtonStyle,
                          ...(group.isDeleted ? disabledButtonStyle : {}),
                        }}
                      >
                        Xóa nhóm
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {group.variants.map((product) => (
                      <div key={product.id} style={variantListItemStyle}>
                        <div style={variantIdentityStyle}>
                          <img
                            src={getProductImage(product)}
                            alt={`${product.brand} ${product.model} ${product.color}`}
                            style={variantImageStyle}
                            onError={useFallbackImage}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{product.color}</div>
                            <small>Tồn kho: {product.stock} | Giá: {Number(product.price).toLocaleString('vi-VN')} VND</small>
                            {product.gallery?.length > 0 && (
                              <div style={galleryRowStyle}>
                                {product.gallery.slice(0, 4).map((image) => (
                                  <img key={image.id} src={image.full_url} alt="Bộ sưu tập ảnh sản phẩm" style={thumbnailStyle} onError={useFallbackImage} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={buttonRowStyle}>
                          <button
                            type="button"
                            onClick={() => startEditProduct(product)}
                            disabled={group.isDeleted}
                            style={{
                              ...secondaryButtonStyle,
                              ...(group.isDeleted ? disabledButtonStyle : {}),
                            }}
                          >
                            Sửa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {pagination && (
              <div style={paginationStyle}>
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} style={secondaryButtonStyle}>⏮</button>
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} style={secondaryButtonStyle}>◀</button>
                <span style={paginationLabelStyle}>Trang {currentPage} / {pagination.last_page}</span>
                <button type="button" disabled={currentPage >= pagination.last_page} onClick={() => setCurrentPage((page) => page + 1)} style={secondaryButtonStyle}>▶</button>
                <button type="button" disabled={currentPage >= pagination.last_page} onClick={() => setCurrentPage(pagination.last_page)} style={secondaryButtonStyle}>⏭</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: 12,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  boxSizing: 'border-box',
};

const sectionStyle = {
  padding: 20,
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  background: '#fff',
};

const filterLoadingStyle = {
  color: '#2563eb',
  fontSize: 13,
  fontWeight: 600,
  margin: '-4px 0 12px',
};

const paginationStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  marginTop: 20,
  flexWrap: 'wrap',
};

const paginationLabelStyle = {
  color: '#374151',
  fontWeight: 600,
  minWidth: 110,
  textAlign: 'center',
};

const listItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '14px 0',
  borderBottom: '1px solid #f3f4f6',
};

const brandIdentityStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
};

const brandLogoStyle = {
  width: 58,
  height: 42,
  flex: '0 0 auto',
  objectFit: 'contain',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  padding: 4,
};

const groupCardStyle = {
  padding: '14px 0',
  borderBottom: '1px solid #f3f4f6',
};

const deletedGroupCardStyle = {
  opacity: 0.55,
  filter: 'grayscale(1)',
};

const groupHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
};

const groupIdentityStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  minWidth: 0,
};

const groupProductImageStyle = {
  width: 104,
  height: 76,
  flex: '0 0 auto',
  objectFit: 'cover',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  background: '#f8fafc',
};

const variantListItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '10px 0',
  borderTop: '1px dashed #e5e7eb',
};

const variantIdentityStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
};

const variantImageStyle = {
  width: 68,
  height: 54,
  flex: '0 0 auto',
  objectFit: 'cover',
  borderRadius: 9,
  border: '1px solid #e5e7eb',
  background: '#f8fafc',
};

const buttonRowStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const primaryButtonStyle = {
  background: '#111827',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 10,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  background: '#fff',
  color: '#111827',
  border: '1px solid #cbd5e1',
  padding: '10px 14px',
  borderRadius: 10,
  cursor: 'pointer',
};

const dangerButtonStyle = {
  background: '#991b1b',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 10,
  cursor: 'pointer',
};

const disabledButtonStyle = {
  background: '#9ca3af',
  color: '#f9fafb',
  border: 'none',
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const labelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

const galleryRowStyle = {
  display: 'flex',
  gap: 8,
  marginTop: 10,
  flexWrap: 'wrap',
};

const galleryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 12,
};

const galleryItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 8,
};

const variantCardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
  background: '#f9fafb',
};

const galleryImageStyle = {
  width: 220,
  height: 220,
  objectFit: 'contain',
  objectPosition: 'center',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  background: '#f8fafc',
  padding: 8,
};

const thumbnailStyle = {
  width: 56,
  height: 56,
  objectFit: 'cover',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
};

export default AdminCatalogPage;
