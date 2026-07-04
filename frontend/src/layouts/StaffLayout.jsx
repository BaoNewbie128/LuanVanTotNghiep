import { NavLink, Outlet } from 'react-router-dom';
import './StaffLayout.css';

const staffNavItems = [
  { to: '/staff/orders', label: 'Đơn hàng' },
  { to: '/staff/inventory', label: 'Tồn kho' },
  { to: '/staff/notifications', label: 'Thông báo' },
  { to: '/staff/posts', label: 'Blog / SEO' },
  { to: '/staff/returns', label: 'Đổi trả' },
  { to: '/staff/tickets', label: 'Hỗ trợ khách hàng' },
];

function StaffLayout() {
  return (
    <div className="staff-layout">
      <aside className="staff-sidebar">
        <div className="staff-sidebar__brand">
          <p className="staff-sidebar__eyebrow">Cổng thông tin</p>
          <h2>JDM WORLD</h2>
        </div>

        <nav className="staff-sidebar__nav" aria-label="Staff navigation">
          {staffNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `staff-sidebar__link${isActive ? ' staff-sidebar__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="staff-content">
        <div className="staff-content__header">
          <div>
            <h1>Quản trị nhân viên</h1>
          </div>
        </div>

        <div className="staff-content__body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default StaffLayout;
