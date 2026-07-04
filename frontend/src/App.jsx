import { lazy, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DarkModeProvider from './context/DarkModeProvider';
import PageTransition from './components/PageTransition';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import renderStaffRoutes from './routes/staffRoutes';
import './App.css';
import './styles/JDMTheme.css';

const ProductListPage = lazy(() => import('./pages/ProductListPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const BlogListingPage = lazy(() => import('./pages/BlogListingPage'));
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage'));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage'));
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage'));
const FAQSupportPage = lazy(() => import('./pages/FAQSupportPage'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminCatalogPage = lazy(() => import('./pages/AdminCatalogPage'));
const AdminUsersCouponsPage = lazy(() => import('./pages/AdminUsersCouponsPage'));
const AdminReturnsPage = lazy(() => import('./pages/AdminReturnsPage'));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const AdminSystemNotificationsPage = lazy(() => import('./pages/AdminSystemNotificationsPage'));

const getDefaultRouteByRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'staff':
      return '/staff/orders';
    default:
      return '/';
  }
};

const canAccessPath = (role, path = '') => {
  if (!path) {
    return false;
  }

  if (path.startsWith('/admin')) {
    return role === 'admin';
  }

  if (path.startsWith('/staff')) {
    return role === 'staff';
  }

  return ['customer', 'admin', 'staff'].includes(role);
};

const ProtectedRoute = ({ children, user }) => {
  const location = useLocation();

  if (!user) {
    localStorage.setItem('redirectAfterLogin', `${location.pathname}${location.search}`);
    return <Navigate to="/login" replace />;
  }

  return children;
};

const RoleRoute = ({ children, user, allowedRoles }) => {
  const location = useLocation();

  if (!user) {
    localStorage.setItem('redirectAfterLogin', `${location.pathname}${location.search}`);
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    localStorage.removeItem('redirectAfterLogin');
    return <Navigate to={getDefaultRouteByRole(user.role)} replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children, user }) => {
  if (user) {
    return <Navigate to={getDefaultRouteByRole(user.role)} replace />;
  }

  return children;
};

function App() {
const [user, setUser] = useState(() => {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');

  if (token && userData) {
    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  return null;
});
  return (
    <DarkModeProvider>
      <Router>
        <Header user={user} setUser={setUser} />
        <PageTransition>
          <Suspense fallback={<div className="page-loading">Đang tải...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/blog" element={<BlogListingPage />} />
            <Route path="/blog/:identifier" element={<BlogDetailPage />} />
            <Route path="/login" element={<PublicOnlyRoute user={user}><LoginPage setUser={setUser} canAccessPath={canAccessPath} getDefaultRouteByRole={getDefaultRouteByRole} /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute user={user}><RegisterPage setUser={setUser} /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<PublicOnlyRoute user={user}><ForgotPasswordPage /></PublicOnlyRoute>} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/faq" element={<FAQSupportPage />} />
            <Route path="/checkout" element={<ProtectedRoute user={user}><CheckoutPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute user={user}><UserProfilePage user={user} setUser={setUser} /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute user={user}><OrderHistoryPage /></ProtectedRoute>} />
            <Route path="/order-confirmation/:orderId" element={<ProtectedRoute user={user}><OrderConfirmationPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute user={user}><NotificationCenterPage /></ProtectedRoute>} />
            <Route path="/admin" element={<RoleRoute user={user} allowedRoles={['admin']}><AdminLayout /></RoleRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="catalog" element={<AdminCatalogPage />} />
              <Route path="users-coupons" element={<AdminUsersCouponsPage />} />
              <Route path="returns" element={<AdminReturnsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="notifications" element={<AdminSystemNotificationsPage />} />
            </Route>
            {renderStaffRoutes(RoleRoute, user)}
          </Routes>
          </Suspense>
        </PageTransition>
      </Router>
    </DarkModeProvider>
  );
}

export default App;
