import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/AuthPages.css';

function RegisterPage({ setUser }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
    address: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username) {
      newErrors.username = 'Vui lòng nhập tên đăng nhập.';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự.';
    } else if (!/^[\p{L}\s0-9-]+$/u.test(formData.username)) {
      newErrors.username = 'Tên chỉ được chứa chữ cái, chữ số, khoảng trắng và dấu gạch ngang.';
    }

    if (!formData.email) {
      newErrors.email = 'Vui lòng nhập email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không đúng định dạng.';
    }

    if (!formData.phone) {
      newErrors.phone = 'Vui lòng nhập số điện thoại.';
    } else if (!/^0[0-9]{9,10}$/.test(formData.phone)) {
      newErrors.phone = 'Số điện thoại phải bắt đầu bằng 0 và gồm 10–11 chữ số.';
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
    }

    if (!formData.password_confirmation) {
      newErrors.password_confirmation = 'Vui lòng xác nhận mật khẩu.';
    } else if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = 'Xác nhận mật khẩu không khớp.';
    }

    if (!formData.address) {
      newErrors.address = 'Vui lòng nhập địa chỉ.';
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
      const response = await axios.post('/api/auth/register', formData);
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      if (setUser) {
        setUser(response.data.user);
      }
      
      setMessage('Đăng ký thành công! Đang chuyển về trang chủ...');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      const validationErrors = error.response?.data?.errors;
      if (validationErrors) {
        const normalizedErrors = Object.fromEntries(
          Object.entries(validationErrors).map(([field, messages]) => [
            field,
            Array.isArray(messages) ? messages[0] : messages,
          ]),
        );
        setErrors(normalizedErrors);
        setMessage(Object.values(normalizedErrors)[0] || 'Dữ liệu đăng ký chưa hợp lệ.');
      } else {
        setMessage(error.response?.data?.message || 'Không thể đăng ký tài khoản.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>ĐĂNG KÝ</h1>
        {message && <div className={`message ${message.includes('thành công') ? 'success' : 'error'}`}>{message}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={errors.username ? 'input-error' : ''}
              placeholder="Nhập tên đăng nhập"
            />
            {errors.username && <span className="error-text">{errors.username}</span>}
          </div>

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
            <label htmlFor="phone">Số Điện Thoại</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={errors.phone ? 'input-error' : ''}
              placeholder="Nhập số điện thoại của bạn"
            />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="address">Địa chỉ</label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={errors.address ? 'input-error' : ''}
              placeholder="Nhập địa chỉ của bạn"
              rows="3"
            />
            {errors.address && <span className="error-text">{errors.address}</span>}
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
              placeholder="Nhập mật khẩu của bạn (tối thiểu 8 ký tự)"
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password_confirmation">Xác nhận mật khẩu</label>
            <input
              type="password"
              id="password_confirmation"
              name="password_confirmation"
              value={formData.password_confirmation}
              onChange={handleChange}
              className={errors.password_confirmation ? 'input-error' : ''}
              placeholder="Xác nhận mật khẩu của bạn"
            />
            {errors.password_confirmation && <span className="error-text">{errors.password_confirmation}</span>}
          </div>

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </button>
        </form>

        <div className="auth-links">
          <span>Đã có tài khoản? </span>
          <Link to="/login">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
