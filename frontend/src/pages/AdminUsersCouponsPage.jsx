import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const api = import.meta.env.VITE_API_BASE_URL || '/api';

const initialCouponForm = {
  code: '',
  type: 'fixed',
  discount: '',
  expiry_date: '',
};

const normalizeDateInputValue = (value) => {
  if (!value) {
    return '';
  }

  return String(value).split('T')[0];
};

const pageShellStyle = {
  maxWidth: 1280,
  margin: '32px auto',
  padding: '0 16px 40px',
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  marginBottom: 12,
  boxSizing: 'border-box',
};

const buttonStyle = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};

const ghostButtonStyle = {
  ...buttonStyle,
  background: '#f3f4f6',
  color: '#111827',
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: '#111827',
  color: '#fff',
};

const dangerButtonStyle = {
  ...buttonStyle,
  background: '#fee2e2',
  color: '#991b1b',
};

const disabledButtonStyle = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

function AdminUsersCouponsPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const headers = { Authorization: `Bearer ${token}` };

  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState(initialCouponForm);
  const [editingCouponId, setEditingCouponId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRequestError = useCallback((requestError, fallbackMessage) => {
    const redirectTo = requestError.response?.data?.redirect_to;

    if (requestError.response?.status === 403 && redirectTo) {
      navigate(redirectTo, { replace: true });
      return;
    }

    setError(requestError.response?.data?.message || fallbackMessage);
  }, [navigate]);

  const loadData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    const requestHeaders = { Authorization: `Bearer ${token}` };

    try {
      const [usersResponse, couponsResponse] = await Promise.all([
        axios.get(`${api}/admin/users`, { headers: requestHeaders, params: { page } }),
        axios.get(`${api}/admin/coupons`, { headers: requestHeaders }),
      ]);

      const usersPayload = usersResponse.data?.data;

      setUsers(usersPayload?.data || []);
      setUsersPagination({
        current_page: usersPayload?.current_page || 1,
        last_page: usersPayload?.last_page || 1,
        total: usersPayload?.total || 0,
      });
      setCoupons(couponsResponse.data?.data || []);
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể tải người dùng và mã giảm giá.');
    } finally {
      setLoading(false);
    }
  }, [handleRequestError, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    loadData();
  }, [loadData, navigate, token]);

  const handleToggleUser = async (user) => {
    setMessage('');
    setError('');

    try {
      const action = user.is_active ? 'lock' : 'unlock';
      const response = await axios.put(`${api}/admin/users/${user.id}/${action}`, {}, { headers });
      setMessage(response.data?.message || 'Đã cập nhật trạng thái người dùng.');
      loadData(usersPagination?.current_page || 1);
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể cập nhật trạng thái người dùng.');
    }
  };

  const handleCouponSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const normalizedCode = couponForm.code.trim().toUpperCase();
    const discount = Number(couponForm.discount);

    if (!normalizedCode) {
      setError('Vui lòng nhập mã giảm giá.');
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      setError('Mã giảm giá chỉ được chứa chữ hoa, số, dấu gạch ngang và gạch dưới.');
      return;
    }

    if (!Number.isFinite(discount) || discount < 0) {
      setError('Giá trị giảm giá phải là số không âm.');
      return;
    }

    if (couponForm.type === 'percent' && discount > 100) {
      setError('Mã giảm giá theo phần trăm không được vượt quá 100.');
      return;
    }

    const payload = {
      ...couponForm,
      code: normalizedCode,
      discount,
      expiry_date: couponForm.expiry_date || null,
    };

    try {
      if (editingCouponId) {
        await axios.put(`${api}/admin/coupons/${editingCouponId}`, payload, { headers });
        setMessage('Đã cập nhật mã giảm giá.');
      } else {
        await axios.post(`${api}/admin/coupons`, payload, { headers });
        setMessage('Đã tạo mã giảm giá.');
      }

      setCouponForm(initialCouponForm);
      setEditingCouponId(null);
      loadData(usersPagination?.current_page || 1);
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể lưu mã giảm giá.');
    }
  };

  const handleEditCoupon = (coupon) => {
    setMessage('');
    setError('');
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code || '',
      discount: coupon.discount ?? '',
      type: coupon.type || 'fixed',
      expiry_date: normalizeDateInputValue(coupon.expiry_date),
    });
  };

  const handleDeleteCoupon = async (coupon) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mã giảm giá ${coupon.code}?`)) {
      return;
    }

    setMessage('');
    setError('');

    try {
      const response = await axios.delete(`${api}/admin/coupons/${coupon.id}`, { headers });
      setMessage(response.data?.message || 'Đã xóa mã giảm giá.');

      if (editingCouponId === coupon.id) {
        setEditingCouponId(null);
        setCouponForm(initialCouponForm);
      }

      loadData(usersPagination?.current_page || 1);
    } catch (requestError) {
      handleRequestError(requestError, 'Không thể xóa mã giảm giá.');
    }
  };

  return (
    <div className="admin-legacy-page" style={pageShellStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Quản lý người dùng và mã giảm giá</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            Quản lý người dùng, khóa/mở khóa tài khoản và thêm, sửa, xóa mã giảm giá từ cơ sở dữ liệu.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/admin/dashboard" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>Tổng quan</Link>
          <Link to="/admin/catalog" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>Danh mục sản phẩm</Link>
        </div>
      </div>

      {message && <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: '#ecfdf5', color: '#166534' }}>{message}</div>}
      {error && <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      {loading ? (
        <div>Đang tải...</div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Người dùng</h2>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
                  Không cho phép khóa chính tài khoản admin đang đăng nhập.
                </p>
              </div>
              <div style={{ color: '#6b7280' }}>Tổng người dùng: {usersPagination?.total || 0}</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Mã', 'Tên người dùng', 'Email', 'Vai trò', 'Số điện thoại', 'Trạng thái', 'Thao tác'].map((heading) => (
                      <th key={heading} style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e5e7eb' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isCurrentAdmin = Number(currentUser?.id) === Number(user.id) && currentUser?.role === 'admin';
                    return (
                      <tr key={user.id}>
                        <td style={cellStyle}>{user.id}</td>
                        <td style={cellStyle}>{user.username || '—'}</td>
                        <td style={cellStyle}>{user.email}</td>
                        <td style={cellStyle}>{user.role === 'admin' ? 'Quản trị viên' : user.role === 'staff' ? 'Nhân viên' : 'Khách hàng'}</td>
                        <td style={cellStyle}>{user.phone || '—'}</td>
                        <td style={cellStyle}>
                          <span style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: user.is_active ? '#dcfce7' : '#fee2e2',
                            color: user.is_active ? '#166534' : '#991b1b',
                            fontSize: 13,
                            fontWeight: 600,
                          }}>
                            {user.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <button
                            type="button"
                            onClick={() => handleToggleUser(user)}
                            disabled={isCurrentAdmin}
                            style={{
                              ...(user.is_active ? dangerButtonStyle : primaryButtonStyle),
                              opacity: isCurrentAdmin ? 0.55 : 1,
                              cursor: isCurrentAdmin ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {user.is_active ? 'Khóa' : 'Mở khóa'}
                          </button>
                          {isCurrentAdmin && (
                            <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>Tài khoản hiện tại</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 16, gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={{
                  ...ghostButtonStyle,
                  ...((!usersPagination || usersPagination.current_page <= 1) ? disabledButtonStyle : {}),
                }}
                disabled={!usersPagination || usersPagination.current_page <= 1}
                onClick={() => loadData(1)}
              >
                ⏮
              </button>
              <button
                type="button"
                style={{
                  ...ghostButtonStyle,
                  ...((!usersPagination || usersPagination.current_page <= 1) ? disabledButtonStyle : {}),
                }}
                disabled={!usersPagination || usersPagination.current_page <= 1}
                onClick={() => loadData((usersPagination?.current_page || 1) - 1)}
              >
                ◀
              </button>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>
                Trang {usersPagination?.current_page || 1} / {usersPagination?.last_page || 1}
              </span>
              <button
                type="button"
                style={{
                  ...ghostButtonStyle,
                  ...((!usersPagination || usersPagination.current_page >= usersPagination.last_page) ? disabledButtonStyle : {}),
                }}
                disabled={!usersPagination || usersPagination.current_page >= usersPagination.last_page}
                onClick={() => loadData((usersPagination?.current_page || 1) + 1)}
              >
                ▶
              </button>
              <button
                type="button"
                style={{
                  ...ghostButtonStyle,
                  ...((!usersPagination || usersPagination.current_page >= usersPagination.last_page) ? disabledButtonStyle : {}),
                }}
                disabled={!usersPagination || usersPagination.current_page >= usersPagination.last_page}
                onClick={() => loadData(usersPagination?.last_page || 1)}
              >
                ⏭
              </button>
            </div>
          </section>

          <section style={{ ...cardStyle, display: 'grid', gap: 24, gridTemplateColumns: 'minmax(300px, 360px) minmax(0, 1fr)' }}>
            <form onSubmit={handleCouponSubmit}>
              <h2 style={{ marginTop: 0 }}>{editingCouponId ? 'Chỉnh sửa mã giảm giá' : 'Tạo mã giảm giá'}</h2>
              <input
                value={couponForm.code}
                onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="Mã giảm giá"
                style={inputStyle}
              />
              <select value={couponForm.type} onChange={(event) => setCouponForm((current) => ({ ...current, type: event.target.value }))} style={inputStyle}>
                <option value="fixed">Giảm số tiền cố định</option>
                <option value="percent">Giảm theo phần trăm</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={couponForm.discount}
                onChange={(event) => setCouponForm((current) => ({ ...current, discount: event.target.value }))}
                placeholder="Giá trị giảm"
                style={inputStyle}
              />
              <input
                type="date"
                value={couponForm.expiry_date}
                onChange={(event) => setCouponForm((current) => ({ ...current, expiry_date: event.target.value }))}
                style={inputStyle}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle}>{editingCouponId ? 'Cập nhật mã' : 'Tạo mã'}</button>
                {editingCouponId && (
                  <button
                    type="button"
                    style={ghostButtonStyle}
                    onClick={() => {
                      setEditingCouponId(null);
                      setCouponForm(initialCouponForm);
                    }}
                  >
                    Hủy chỉnh sửa
                  </button>
                )}
              </div>
            </form>

            <div>
              <h2 style={{ marginTop: 0 }}>Danh sách mã giảm giá</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Mã giảm giá', 'Loại', 'Giá trị giảm', 'Ngày hết hạn', 'Thao tác'].map((heading) => (
                        <th key={heading} style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e5e7eb' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((coupon) => (
                      <tr key={coupon.id}>
                        <td style={cellStyle}>{coupon.code}</td>
                        <td style={cellStyle}>{coupon.type === 'percent' ? 'Phần trăm' : 'Số tiền cố định'}</td>
                        <td style={cellStyle}>
                          {coupon.type === 'percent' ? `${Number(coupon.discount)}%` : `${Number(coupon.discount).toLocaleString('vi-VN')} VND`}
                        </td>
                        <td style={cellStyle}>{coupon.expiry_date || 'Không giới hạn'}</td>
                        <td style={cellStyle}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" style={ghostButtonStyle} onClick={() => handleEditCoupon(coupon)}>Sửa</button>
                            <button type="button" style={dangerButtonStyle} onClick={() => handleDeleteCoupon(coupon)}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const cellStyle = {
  padding: 12,
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'top',
};

export default AdminUsersCouponsPage;
