import { NavLink, Outlet } from 'react-router-dom';
import './AdminLayout.css';

const links = [
  ['/admin/dashboard', 'Tổng quan'], ['/admin/catalog', 'Sản phẩm'], ['/admin/users-coupons', 'Người dùng & Mã giảm giá'],
  ['/admin/returns', 'Hoàn tiền & Đổi trả'], ['/admin/reports', 'Báo cáo & KPI'], ['/admin/notifications', 'Cảnh báo hệ thống'],
];

export default function AdminLayout() {
  return <div className="admin-shell"><nav className="admin-nav" aria-label="Điều hướng quản trị"><div className="admin-nav-brand"><small>TRUNG TÂM QUẢN TRỊ</small><strong>JDM WORLD</strong></div><div className="admin-nav-links">{links.map(([to,label])=><NavLink key={to} to={to} className={({isActive})=>isActive?'active':''}>{label}</NavLink>)}</div></nav><main className="admin-main"><Outlet /></main></div>;
}
