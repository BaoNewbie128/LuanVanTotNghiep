import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './UserProfilePage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const FALLBACK_PRODUCT_IMAGE = '/images/ryosuke.jpg';
const PURCHASED_ORDER_STATUSES = new Set(['paid', 'shipping', 'completed']);

const normalizeOrders = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getProductName = (product) =>
  [product?.brand, product?.model].filter(Boolean).join(' ') || product?.name || 'Sản phẩm JDM';

const getProductImage = (product) => {
  const image = product?.image;
  if (!image) return FALLBACK_PRODUCT_IMAGE;
  return image.startsWith('/') || image.startsWith('http') ? image : image.includes('/') ? `/storage/${image}` : `/images/${image}`;
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

const initialProfileState = {
  username: '',
  email: '',
  phone: '',
  address: '',
  avatar: null,
};

const initialPasswordState = {
  current_password: '',
  new_password: '',
  new_password_confirmation: '',
};

function UserProfilePage() {
  const token = useMemo(() => localStorage.getItem('token'), []);
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const [profileForm, setProfileForm] = useState(initialProfileState);
  const [passwordForm, setPasswordForm] = useState(initialPasswordState);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loadingGarage, setLoadingGarage] = useState(true);
  const [garageMessage, setGarageMessage] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setProfileMessage({ type: 'error', text: 'Vui lòng đăng nhập để xem hồ sơ.' });
        setLoadingProfile(false);
        return;
      }

      try {
        const response = await axios.get(`${API_BASE_URL}/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const user = response.data || {};
        setProfileForm({
          username: user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          address: user.address || '',
          avatar: null,
        });
        setPreviewUrl(user.avatar ? `/storage/avatars/${user.avatar}` : '');

        const updatedStoredUser = { ...(storedUser || {}), ...user };
        localStorage.setItem('user', JSON.stringify(updatedStoredUser));
      } catch (error) {
        setProfileMessage({
          type: 'error',
          text: error.response?.data?.message || 'Không thể tải thông tin hồ sơ.',
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [storedUser, token]);

  useEffect(() => {
    const fetchGarage = async () => {
      if (!token) {
        setLoadingGarage(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [ordersResult, wishlistResult] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/orders?per_page=100`, { headers }),
        axios.get(`${API_BASE_URL}/wishlist`, { headers }),
      ]);

      if (ordersResult.status === 'fulfilled') {
        setOrders(normalizeOrders(ordersResult.value.data));
      }

      if (wishlistResult.status === 'fulfilled') {
        setWishlist(Array.isArray(wishlistResult.value.data?.data) ? wishlistResult.value.data.data : []);
      }

      if (ordersResult.status === 'rejected' || wishlistResult.status === 'rejected') {
        setGarageMessage('Một phần dữ liệu garage chưa thể tải. Bạn có thể thử làm mới trang.');
      }

      setLoadingGarage(false);
    };

    fetchGarage();
  }, [token]);

  const purchasedProducts = useMemo(() => {
    const productsById = new Map();

    orders
      .filter((order) => PURCHASED_ORDER_STATUSES.has(order.status))
      .forEach((order) => {
        (order.items || []).forEach((item) => {
          const product = item.product;
          if (!product?.id) return;

          const current = productsById.get(product.id);
          productsById.set(product.id, {
            product,
            quantity: (current?.quantity || 0) + Number(item.quantity || 1),
            latestPurchase: current?.latestPurchase || order.created_at,
            price: item.price ?? product.price,
          });
        });
      });

    return Array.from(productsById.values()).slice(0, 6);
  }, [orders]);

  const favoriteProducts = useMemo(
    () => wishlist.map((item) => item.product).filter(Boolean).slice(0, 6),
    [wishlist]
  );

  const validateProfileForm = () => {
    const errors = {};

    if (!profileForm.username.trim()) {
      errors.username = 'Tên người dùng là bắt buộc.';
    } else if (!/^[\p{L}\s0-9_]+$/u.test(profileForm.username.trim())) {
      errors.username = 'Tên không được chứa ký tự đặc biệt.';
    }

    if (!profileForm.email.trim()) {
      errors.email = 'Email là bắt buộc.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      errors.email = 'Email không đúng định dạng.';
    }

    if (!profileForm.phone.trim()) {
      errors.phone = 'Số điện thoại là bắt buộc.';
    }

    if (!profileForm.address.trim()) {
      errors.address = 'Địa chỉ là bắt buộc.';
    }

    if (profileForm.avatar) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(profileForm.avatar.type)) {
        errors.avatar = 'Ảnh phải có định dạng jpeg, png hoặc jpg.';
      }
      if (profileForm.avatar.size > 2 * 1024 * 1024) {
        errors.avatar = 'Ảnh đại diện không được vượt quá 2MB.';
      }
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = () => {
    const errors = {};

    if (!passwordForm.current_password) {
      errors.current_password = 'Vui lòng nhập mật khẩu hiện tại.';
    }

    if (!passwordForm.new_password) {
      errors.new_password = 'Vui lòng nhập mật khẩu mới.';
    } else if (passwordForm.new_password.length < 8) {
      errors.new_password = 'Mật khẩu mới phải có ít nhất 8 ký tự.';
    }

    if (!passwordForm.new_password_confirmation) {
      errors.new_password_confirmation = 'Vui lòng xác nhận mật khẩu mới.';
    } else if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      errors.new_password_confirmation = 'Xác nhận mật khẩu không khớp.';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileChange = (event) => {
    const { name, value, files } = event.target;

    if (name === 'avatar') {
      const file = files?.[0] || null;
      setProfileForm((prev) => ({ ...prev, avatar: file }));
      if (file) {
        setPreviewUrl(URL.createObjectURL(file));
      }
    } else {
      setProfileForm((prev) => ({ ...prev, [name]: value }));
    }

    setProfileErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setPasswordErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMessage({ type: '', text: '' });

    if (!validateProfileForm() || !token) {
      return;
    }

    setSavingProfile(true);

    try {
      const formData = new FormData();
      formData.append('username', profileForm.username.trim());
      formData.append('email', profileForm.email.trim());
      formData.append('phone', profileForm.phone.trim());
      formData.append('address', profileForm.address.trim());
      if (profileForm.avatar) {
        formData.append('avatar', profileForm.avatar);
      }

      const response = await axios.post(`${API_BASE_URL}/user/profile?_method=PUT`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const updatedUser = response.data?.user || {};
      localStorage.setItem('user', JSON.stringify({ ...(storedUser || {}), ...updatedUser }));

      setProfileForm((prev) => ({ ...prev, avatar: null }));
      if (updatedUser.avatar) {
        setPreviewUrl(`/storage/avatars/${updatedUser.avatar}`);
      }

      setProfileMessage({
        type: 'success',
        text: response.data?.message || 'Cập nhật hồ sơ thành công.',
      });
    } catch (error) {
      const validationErrors = error.response?.data?.errors || {};
      if (Object.keys(validationErrors).length > 0) {
        const flattenedErrors = Object.fromEntries(
          Object.entries(validationErrors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        );
        setProfileErrors(flattenedErrors);
      }

      setProfileMessage({
        type: 'error',
        text: error.response?.data?.message || 'Cập nhật hồ sơ thất bại.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (!validatePasswordForm() || !token) {
      return;
    }

    setChangingPassword(true);

    try {
      const response = await axios.put(
        `${API_BASE_URL}/user/password`,
        passwordForm,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setPasswordForm(initialPasswordState);
      setPasswordMessage({
        type: 'success',
        text: response.data?.message || 'Đổi mật khẩu thành công.',
      });
    } catch (error) {
      const validationErrors = error.response?.data?.errors || {};
      if (Object.keys(validationErrors).length > 0) {
        const flattenedErrors = Object.fromEntries(
          Object.entries(validationErrors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        );
        setPasswordErrors(flattenedErrors);
      }

      setPasswordMessage({
        type: 'error',
        text: error.response?.data?.message || 'Đổi mật khẩu thất bại.',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loadingProfile) {
    return <div className="jdm-profile-loading">Đang tải garage cá nhân...</div>;
  }

  return (
    <div className="jdm-profile-page">
      <section className="jdm-profile-hero">
        <div className="jdm-profile-hero__overlay" />
        <div className="jdm-profile-hero__content container">
          <div>
            <p className="jdm-profile-eyebrow">JDM OWNER GARAGE</p>
            <h1 className="jdm-profile-title">Hồ sơ tay lái của bạn</h1>
            <p className="jdm-profile-subtitle">
              Tùy chỉnh thông tin cá nhân, avatar và bảo mật tài khoản trong không gian mang chất garage xe Nhật.
            </p>
          </div>
          <div className="jdm-profile-badges">
            <span>🏁 Member Profile</span>
            <span>🔐 Secure Account</span>
            <span>📸 Custom Avatar</span>
          </div>
        </div>
      </section>

      <div className="container jdm-profile-content">
        <section className="jdm-garage-overview" aria-label="Tổng quan garage cá nhân">
          <div className="jdm-overview-intro">
            <span className="jdm-overview-icon">⌁</span>
            <div>
              <p>GARAGE OVERVIEW</p>
              <h2>Hành trình JDM của bạn</h2>
            </div>
          </div>
          <div className="jdm-overview-stat">
            <strong>{orders.length}</strong>
            <span>Đơn hàng</span>
          </div>
          <div className="jdm-overview-stat">
            <strong>{purchasedProducts.length}</strong>
            <span>Mẫu xe đã mua</span>
          </div>
          <div className="jdm-overview-stat">
            <strong>{wishlist.length}</strong>
            <span>Đang yêu thích</span>
          </div>
        </section>

        <div className="row g-4 align-items-start">
          <div className="col-xl-4 col-lg-5">
            <aside className="jdm-profile-sidebar">
              <div className="jdm-profile-summary-card">
                <div className="jdm-profile-summary-card__glow" />
                <img
                  src={previewUrl || 'https://via.placeholder.com/240x240/111111/ffffff?text=JDM'}
                  alt="Avatar"
                  className="jdm-profile-avatar"
                />
                <div className="jdm-profile-name-block">
                  <p className="jdm-profile-rank">DRIVER ID</p>
                  <h2>{profileForm.username || 'Người dùng'}</h2>
                  <p>{profileForm.email || 'Chưa có email'}</p>
                  <span>{profileForm.phone || 'Chưa có số điện thoại'}</span>
                </div>

                <div className="jdm-profile-stats-grid">
                  <div>
                    <strong>Đơn hàng</strong>
                    <span>{orders.length}</span>
                  </div>
                  <div>
                    <strong>Đã mua</strong>
                    <span>{purchasedProducts.length} mẫu xe</span>
                  </div>
                  <div>
                    <strong>Yêu thích</strong>
                    <span>{wishlist.length} sản phẩm</span>
                  </div>
                  <div>
                    <strong>Tài khoản</strong>
                    <span>{storedUser?.role || 'customer'}</span>
                  </div>
                </div>
              </div>

              <div className="jdm-profile-tip-card">
                <h3>Gợi ý nâng cấp hồ sơ</h3>
                <ul>
                  <li>Dùng avatar phong cách xe JDM hoặc logo thương hiệu yêu thích.</li>
                  <li>Cập nhật địa chỉ chính xác để checkout nhanh hơn.</li>
                  <li>Đổi mật khẩu định kỳ để bảo vệ garage của bạn.</li>
                </ul>
              </div>
            </aside>
          </div>

          <div className="col-xl-8 col-lg-7">
            <div className="jdm-panel mb-4">
              <div className="jdm-panel__header">
                <div>
                  <p className="jdm-panel__kicker">PROFILE TUNING</p>
                  <h2>Thông tin cá nhân</h2>
                </div>
                <span className="jdm-panel__chip">Editable</span>
              </div>

              {profileMessage.text && (
                <div className={`alert ${profileMessage.type === 'success' ? 'alert-success' : 'alert-danger'} jdm-alert`}>
                  {profileMessage.text}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="jdm-profile-form">
                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="jdm-label">Tên người dùng</label>
                    <input
                      type="text"
                      name="username"
                      className={`form-control jdm-input ${profileErrors.username ? 'is-invalid' : ''}`}
                      value={profileForm.username}
                      onChange={handleProfileChange}
                      placeholder="Nhập tên hiển thị"
                    />
                    {profileErrors.username && <div className="invalid-feedback">{profileErrors.username}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="jdm-label">Email</label>
                    <input
                      type="email"
                      name="email"
                      className={`form-control jdm-input ${profileErrors.email ? 'is-invalid' : ''}`}
                      value={profileForm.email}
                      onChange={handleProfileChange}
                      placeholder="you@example.com"
                    />
                    {profileErrors.email && <div className="invalid-feedback">{profileErrors.email}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="jdm-label">Số điện thoại</label>
                    <input
                      type="text"
                      name="phone"
                      className={`form-control jdm-input ${profileErrors.phone ? 'is-invalid' : ''}`}
                      value={profileForm.phone}
                      onChange={handleProfileChange}
                      placeholder="Nhập số điện thoại"
                    />
                    {profileErrors.phone && <div className="invalid-feedback">{profileErrors.phone}</div>}
                  </div>

                  <div className="col-md-6">
                    <label className="jdm-label">Ảnh đại diện</label>
                    <input
                      type="file"
                      name="avatar"
                      accept="image/jpeg,image/png,image/jpg"
                      className={`form-control jdm-input jdm-file-input ${profileErrors.avatar ? 'is-invalid' : ''}`}
                      onChange={handleProfileChange}
                    />
                    <small className="jdm-helper-text">Chỉ nhận JPG/PNG, dung lượng tối đa 2MB.</small>
                    {profileErrors.avatar && <div className="invalid-feedback">{profileErrors.avatar}</div>}
                  </div>

                  <div className="col-12">
                    <label className="jdm-label">Địa chỉ giao hàng</label>
                    <textarea
                      name="address"
                      rows="5"
                      className={`form-control jdm-input ${profileErrors.address ? 'is-invalid' : ''}`}
                      value={profileForm.address}
                      onChange={handleProfileChange}
                      placeholder="Nhập địa chỉ chi tiết"
                    />
                    {profileErrors.address && <div className="invalid-feedback">{profileErrors.address}</div>}
                  </div>
                </div>

                <div className="jdm-profile-actions">
                  <button type="submit" className="jdm-primary-btn" disabled={savingProfile}>
                    {savingProfile ? 'Đang lưu cấu hình...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </div>

            <div className="jdm-panel">
              <div className="jdm-panel__header">
                <div>
                  <p className="jdm-panel__kicker">SECURITY PIT STOP</p>
                  <h2>Đổi mật khẩu</h2>
                </div>
                <span className="jdm-panel__chip danger">Protected</span>
              </div>

              {passwordMessage.text && (
                <div className={`alert ${passwordMessage.type === 'success' ? 'alert-success' : 'alert-danger'} jdm-alert`}>
                  {passwordMessage.text}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="jdm-profile-form">
                <div className="row g-4">
                  <div className="col-md-4">
                    <label className="jdm-label">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      name="current_password"
                      className={`form-control jdm-input ${passwordErrors.current_password ? 'is-invalid' : ''}`}
                      value={passwordForm.current_password}
                      onChange={handlePasswordChange}
                    />
                    {passwordErrors.current_password && (
                      <div className="invalid-feedback">{passwordErrors.current_password}</div>
                    )}
                  </div>

                  <div className="col-md-4">
                    <label className="jdm-label">Mật khẩu mới</label>
                    <input
                      type="password"
                      name="new_password"
                      className={`form-control jdm-input ${passwordErrors.new_password ? 'is-invalid' : ''}`}
                      value={passwordForm.new_password}
                      onChange={handlePasswordChange}
                    />
                    {passwordErrors.new_password && <div className="invalid-feedback">{passwordErrors.new_password}</div>}
                  </div>

                  <div className="col-md-4">
                    <label className="jdm-label">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      name="new_password_confirmation"
                      className={`form-control jdm-input ${passwordErrors.new_password_confirmation ? 'is-invalid' : ''}`}
                      value={passwordForm.new_password_confirmation}
                      onChange={handlePasswordChange}
                    />
                    {passwordErrors.new_password_confirmation && (
                      <div className="invalid-feedback">{passwordErrors.new_password_confirmation}</div>
                    )}
                  </div>
                </div>

                <div className="jdm-profile-actions">
                  <button type="submit" className="jdm-secondary-btn" disabled={changingPassword}>
                    {changingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <section className="jdm-collection-panel">
          <div className="jdm-collection-header">
            <div>
              <p className="jdm-panel__kicker">MY COLLECTION</p>
              <h2>Sản phẩm đã mua</h2>
              <span>Những sản phẩm thuộc đơn đã thanh toán, đang giao hoặc đã hoàn tất.</span>
            </div>
            <Link to="/orders" className="jdm-text-link">Xem tất cả đơn hàng <span>→</span></Link>
          </div>

          {garageMessage && <div className="jdm-garage-notice">{garageMessage}</div>}
          {loadingGarage ? (
            <div className="jdm-collection-state">Đang đồng bộ garage của bạn...</div>
          ) : purchasedProducts.length === 0 ? (
            <div className="jdm-collection-state">
              <span className="jdm-empty-icon">🏁</span>
              <strong>Garage đang chờ chiếc xe đầu tiên</strong>
              <p>Sản phẩm sẽ xuất hiện tại đây khi đơn hàng được xác nhận thanh toán.</p>
              <Link to="/products" className="jdm-primary-btn jdm-inline-btn">Khám phá sản phẩm</Link>
            </div>
          ) : (
            <div className="jdm-product-mini-grid">
              {purchasedProducts.map(({ product, quantity, price }) => (
                <Link to={`/products/${product.id}`} className="jdm-product-mini-card" key={product.id}>
                  <div className="jdm-product-mini-card__image-wrap">
                    <img src={getProductImage(product)} alt={getProductName(product)} />
                    <span>Đã sở hữu ×{quantity}</span>
                  </div>
                  <div className="jdm-product-mini-card__body">
                    <small>{product.category?.name || product.brand || 'JDM MODEL'}</small>
                    <h3>{getProductName(product)}</h3>
                    <strong>{formatMoney(price)}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="jdm-collection-panel">
          <div className="jdm-collection-header">
            <div>
              <p className="jdm-panel__kicker">DREAM GARAGE</p>
              <h2>Sản phẩm yêu thích</h2>
              <span>Danh sách những mẫu xe bạn đang quan tâm.</span>
            </div>
            <Link to="/wishlist" className="jdm-text-link">Mở danh sách yêu thích <span>→</span></Link>
          </div>

          {loadingGarage ? (
            <div className="jdm-collection-state">Đang tải danh sách yêu thích...</div>
          ) : favoriteProducts.length === 0 ? (
            <div className="jdm-collection-state">
              <span className="jdm-empty-icon">♡</span>
              <strong>Chưa có sản phẩm yêu thích</strong>
              <p>Nhấn biểu tượng trái tim trên sản phẩm để lưu vào dream garage.</p>
              <Link to="/products" className="jdm-secondary-btn jdm-inline-btn">Tìm mẫu xe phù hợp</Link>
            </div>
          ) : (
            <div className="jdm-product-mini-grid">
              {favoriteProducts.map((product) => (
                <Link to={`/products/${product.id}`} className="jdm-product-mini-card" key={product.id}>
                  <div className="jdm-product-mini-card__image-wrap">
                    <img src={getProductImage(product)} alt={getProductName(product)} />
                    <span className="favorite">♥ Yêu thích</span>
                  </div>
                  <div className="jdm-product-mini-card__body">
                    <small>{product.category?.name || product.brand || 'JDM MODEL'}</small>
                    <h3>{getProductName(product)}</h3>
                    <strong>{formatMoney(product.price)}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default UserProfilePage;
