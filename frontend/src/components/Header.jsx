import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDarkMode } from '../hooks/useDarkMode';
import './Header.css';

function Header({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const userMenuRef = useRef(null);
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const ordersPath = user ? '/orders' : '/login';
  const managementPath = user?.role === 'staff' ? '/staff/orders' : '/admin';
  const isStaffPortal = location.pathname.startsWith('/staff');
  const isAdminPortal = location.pathname.startsWith('/admin');
  const isManagementPortal = isStaffPortal || isAdminPortal;
  const role = user?.role || 'guest';

  const logoPath = role === 'staff'
    ? '/staff/orders'
    : role === 'admin'
      ? '/admin/dashboard'
      : '/';

  const showCustomerNavigation = !isManagementPortal && (role === 'guest' || role === 'customer');
  const showManagementQuickLinks = role === 'admin' || (isStaffPortal && role === 'staff');

  const handleGuestOrdersClick = () => {
    if (!user) {
      localStorage.setItem('redirectAfterLogin', '/orders');
      setShowMobileMenu(false);
    }
  };

  useEffect(() => {
    if (!showMenu) return undefined;

    const closeOnOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowMenu(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showMenu]);

  useEffect(() => {
    setShowMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    const fetchWishlistCount = async () => {
      const token = localStorage.getItem('token');
      const guestCount = JSON.parse(localStorage.getItem('guest_wishlist') || '[]').length;

      try {
      const response = await axios.get('/api/wishlist/count', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        setWishlistCount(token ? Number(response.data?.count || 0) : Math.max(Number(response.data?.count || 0), guestCount));
      } catch {
        setWishlistCount(guestCount);
      }
    };

    fetchWishlistCount();
    window.addEventListener('wishlistUpdated', fetchWishlistCount);
    window.addEventListener('storage', fetchWishlistCount);

    return () => {
      window.removeEventListener('wishlistUpdated', fetchWishlistCount);
      window.removeEventListener('storage', fetchWishlistCount);
    };
  }, [user]);

  useEffect(() => {
    const fetchNotificationCount = async () => {
      const token = localStorage.getItem('token');
      if (!user || !token) {
        setNotificationCount(0);
        return;
      }

      try {
        const response = await axios.get('/api/notifications/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotificationCount(Number(response.data?.unread_count ?? response.data?.count ?? 0));
      } catch {
        setNotificationCount(0);
      }
    };

    fetchNotificationCount();
    const timer = window.setInterval(fetchNotificationCount, 60000);
    window.addEventListener('notificationsUpdated', fetchNotificationCount);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('notificationsUpdated', fetchNotificationCount);
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.dispatchEvent(new Event('wishlistUpdated'));
    navigate('/');
    setShowMobileMenu(false);
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  return (
    <header className="header bg-gradient-to-r from-primary-500 to-purple-600 dark:from-gray-800 dark:to-gray-900">
      <div className="header-container">
        <Link to={logoPath} className="logo">
          <h1>
            <img src="/images/icon.png" alt="" className="logo_image" />
            <span className="logo-copy"><span>JDM WORLD</span></span>
          </h1>
        </Link>

        {/* Desktop Navigation */}
        <nav className="nav-menu desktop-nav">
          {showCustomerNavigation && (
            <>
              <Link to="/" className="nav-link"><span className="nav-link-icon" aria-hidden="true">🏠</span>Trang Chủ</Link>
              <Link to="/products" className="nav-link"><span className="nav-link-icon" aria-hidden="true">🚘</span>Sản Phẩm</Link>
              <Link to="/blog" className="nav-link"><span className="nav-link-icon" aria-hidden="true">📰</span>Blog</Link>
              <Link to="/faq" className="nav-link"><span className="nav-link-icon" aria-hidden="true">☎</span>Hỗ Trợ</Link>
              <Link to={ordersPath} className="nav-link" onClick={handleGuestOrdersClick}><span className="nav-link-icon" aria-hidden="true">📦</span>Đơn Hàng</Link>
              <Link to="/wishlist" className="nav-link header-icon-link" title="Danh sách yêu thích">
                <span className="nav-link-icon nav-link-icon--heart" aria-hidden="true">♥</span><span className="header-icon-text">Yêu Thích</span>
                {wishlistCount > 0 && <span className="nav-badge">{wishlistCount}</span>}
              </Link>
              <Link to="/cart" className="nav-link"><span className="nav-link-icon" aria-hidden="true">🛒</span>Giỏ Hàng</Link>
            </>
          )}

          {showManagementQuickLinks && (
            <>
              <Link to={role === 'staff' ? '/staff/orders' : '/admin/dashboard'} className="nav-link">
                Tổng quan
              </Link>
              <Link to={role === 'staff' ? '/staff/orders' : '/admin/catalog'} className="nav-link">
                {role === 'staff' ? 'Đơn Hàng' : 'Sản Phẩm'}
              </Link>
              {role === 'admin' && (
                <Link to="/admin/users-coupons" className="nav-link">Người dùng &amp; Mã giảm giá</Link>
              )}
              {role === 'staff' && <Link to="/staff/inventory" className="nav-link">Kho Hàng</Link>}
              {role === 'staff' && <Link to="/staff/posts" className="nav-link">Bài viết / SEO</Link>}
            </>
          )}
          
          {/* Dark Mode Toggle */}
          <button 
            onClick={toggleDarkMode}
            className="dark-mode-toggle p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-300"
            title={isDarkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
           {user ? (
             <div className="user-menu" ref={userMenuRef}>
               <Link to="/notifications" className="notification-icon" title="Trung tâm thông báo">
                 🔔
                 {notificationCount > 0 && <span className="notification-count-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>}
               </Link>
               <button 
                 className="user-btn"
                 onClick={() => setShowMenu((isOpen) => !isOpen)}
                 aria-expanded={showMenu}
                 aria-haspopup="menu"
               >
                 {user.username} ▼
               </button>
               {showMenu && (
                 <div className="dropdown-menu">
                   <Link to="/profile" className="dropdown-item">Hồ Sơ Cá Nhân</Link>
                   <Link to="/orders" className="dropdown-item">Lịch Sử Đơn Hàng</Link>
                   <Link to="/notifications" className="dropdown-item">Thông Báo</Link>
                    {(user.role === 'admin' || user.role === 'staff') && (
                      <Link to={managementPath} className="dropdown-item">Quản Lý</Link>
                   )}
                   <button 
                     className="dropdown-item logout-btn"
                     onClick={handleLogout}
                   >
                     Đăng Xuất
                   </button>
                 </div>
               )}
             </div>
           ) : (
             <div className="auth-links">
               <Link to="/login" className="nav-link"><span className="nav-link-icon" aria-hidden="true">🔑</span>Đăng Nhập</Link>
               <Link to="/register" className="nav-link register-btn"><span className="nav-link-icon" aria-hidden="true">📝</span>Đăng Ký</Link>
             </div>
           )}
        </nav>

        {/* Mobile Menu Button */}
        <button 
          className="mobile-menu-btn"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label="Toggle menu"
        >
          {showMobileMenu ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Navigation */}
      {showMobileMenu && (
        <div className="mobile-nav">
          {showCustomerNavigation && (
            <>
              <Link to="/" className="mobile-nav-link" onClick={closeMobileMenu}><span className="nav-link-icon" aria-hidden="true">🏠</span>Trang Chủ</Link>
              <Link to="/products" className="mobile-nav-link" onClick={closeMobileMenu}><span className="nav-link-icon" aria-hidden="true">🚘</span>Sản Phẩm</Link>
              <Link to="/blog" className="mobile-nav-link" onClick={closeMobileMenu}><span className="nav-link-icon" aria-hidden="true">📰</span>Blog</Link>
              <Link to="/faq" className="mobile-nav-link" onClick={closeMobileMenu}><span className="nav-link-icon" aria-hidden="true">🎧</span>Hỗ Trợ</Link>
              <Link to={ordersPath} className="mobile-nav-link" onClick={handleGuestOrdersClick}><span className="nav-link-icon" aria-hidden="true">📦</span>Đơn Hàng</Link>
              <Link to="/wishlist" className="mobile-nav-link" onClick={closeMobileMenu}>
                <span className="nav-link-icon nav-link-icon--heart" aria-hidden="true">♥</span>Yêu Thích {wishlistCount > 0 && <span className="mobile-nav-badge">{wishlistCount}</span>}
              </Link>
              <Link to="/cart" className="mobile-nav-link" onClick={closeMobileMenu}><span className="nav-link-icon" aria-hidden="true">🛒</span>Giỏ Hàng</Link>
            </>
          )}

          {showManagementQuickLinks && (
            <>
              <Link to={role === 'staff' ? '/staff/orders' : '/admin/dashboard'} className="mobile-nav-link" onClick={closeMobileMenu}>📊 Tổng quan</Link>
              <Link to={role === 'staff' ? '/staff/orders' : '/admin/catalog'} className="mobile-nav-link" onClick={closeMobileMenu}>
                {role === 'staff' ? '📦 Đơn Hàng' : '📚 Sản Phẩm'}
              </Link>
              {role === 'admin' && (
                <Link to="/admin/users-coupons" className="mobile-nav-link" onClick={closeMobileMenu}>Người dùng &amp; Mã giảm giá</Link>
              )}
              {role === 'staff' && <Link to="/staff/inventory" className="mobile-nav-link" onClick={closeMobileMenu}>🏬 Kho Hàng</Link>}
              {role === 'staff' && <Link to="/staff/posts" className="mobile-nav-link" onClick={closeMobileMenu}>📰 Bài viết / SEO</Link>}
            </>
          )}
          
          <div className="mobile-nav-divider"></div>
          
          <button 
            onClick={toggleDarkMode}
            className="mobile-nav-link mobile-dark-toggle"
          >
            {isDarkMode ? '☀️ Chế độ sáng' : '🌙 Chế độ tối'}
          </button>
          
          {user ? (
            <>
              <Link to="/profile" className="mobile-nav-link" onClick={closeMobileMenu}>👤 Hồ Sơ</Link>
              <Link to="/orders" className="mobile-nav-link" onClick={closeMobileMenu}>📦 Đơn Hàng</Link>
              <Link to="/notifications" className="mobile-nav-link" onClick={closeMobileMenu}>🔔 Thông Báo</Link>
              {(user.role === 'admin' || user.role === 'staff') && (
                <Link to={managementPath} className="mobile-nav-link" onClick={closeMobileMenu}>⚙️ Quản Lý</Link>
              )}
              <button className="mobile-nav-link mobile-logout" onClick={handleLogout}>
                🚪 Đăng Xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-nav-link" onClick={closeMobileMenu}>🔑 Đăng Nhập</Link>
              <Link to="/register" className="mobile-nav-link mobile-register" onClick={closeMobileMenu}>📝 Đăng Ký</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;
