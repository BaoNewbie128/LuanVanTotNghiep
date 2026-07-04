import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/AuthPages.css';

const api = import.meta.env.VITE_API_BASE_URL || '/api';

function LoginPage({ setUser, canAccessPath, getDefaultRouteByRole }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email không được để trống';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Lỗi định dạng email';
    }

    if (!formData.password) {
      newErrors.password = 'Mật khẩu không được để trống';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${api}/auth/login`, formData);
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      if (setUser) {
        setUser(response.data.user);
      }

      // Merge guest cart to user account after login
      const guestCart = localStorage.getItem('guest_cart');
      if (guestCart) {
        try {
          await axios.post(`${api}/cart/merge`, 
            { guest_cart: JSON.parse(guestCart) },
            { headers: { Authorization: `Bearer ${response.data.token}` } }
          );
          localStorage.removeItem('guest_cart');
        } catch {
          // Merge failed - guest cart will be preserved in localStorage
        }
      }

      // Merge guest wishlist to user account after login
      const guestWishlist = localStorage.getItem('guest_wishlist');
      if (guestWishlist) {
        try {
          await axios.post(`${api}/wishlist/merge`,
            { guest_wishlist: JSON.parse(guestWishlist) },
            { headers: { Authorization: `Bearer ${response.data.token}` } }
          );
          localStorage.removeItem('guest_wishlist');
          window.dispatchEvent(new Event('wishlistUpdated'));
        } catch {
          // Merge failed - guest wishlist will be preserved in localStorage
        }
      }

      setMessage('Đăng nhập thành công!');
      
      const userRole = response.data.user.role;
      const redirectAfterLogin = localStorage.getItem('redirectAfterLogin');
      localStorage.removeItem('redirectAfterLogin');

      const fallbackRoute = response.data.redirect_to || getDefaultRouteByRole(userRole);

      if (canAccessPath(userRole, redirectAfterLogin)) {
        navigate(redirectAfterLogin, { replace: true });
      } else {
        navigate(fallbackRoute, { replace: true });
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Đăng nhập</h1>
        {message && <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>{message}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'input-error' : ''}
              placeholder="Nhập email của bạn"
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'input-error' : ''}
              placeholder="Nhập mật khẩu của bạn"
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
          <span> | Bạn chưa có tài khoản ? </span>
          <Link to="/register">Đăng ký</Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
