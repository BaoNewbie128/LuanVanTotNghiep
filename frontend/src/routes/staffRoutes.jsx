/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';

const StaffLayout = lazy(() => import('../layouts/StaffLayout'));
const StaffInventoryPage = lazy(() => import('../pages/staff/StaffInventoryPage'));
const StaffNotificationsPage = lazy(() => import('../pages/staff/StaffNotificationsPage'));
const StaffOrdersPage = lazy(() => import('../pages/staff/StaffOrdersPage'));
const StaffPostsPage = lazy(() => import('../pages/staff/StaffPostsPage'));
const StaffReturnsPage = lazy(() => import('../pages/staff/StaffReturnsPage'));
const StaffTicketsPage = lazy(() => import('../pages/staff/StaffTicketsPage'));

const renderStaffRoutes = (RoleRoute, user) => (
  <Route
    path="/staff"
    element={
      <RoleRoute user={user} allowedRoles={['staff']}>
        <StaffLayout />
      </RoleRoute>
    }
  >
    <Route index element={<Navigate to="orders" replace />} />
    <Route path="orders" element={<StaffOrdersPage />} />
    <Route path="inventory" element={<StaffInventoryPage />} />
    <Route path="notifications" element={<StaffNotificationsPage />} />
    <Route path="posts" element={<StaffPostsPage />} />
    <Route path="returns" element={<StaffReturnsPage />} />
    <Route path="tickets" element={<StaffTicketsPage />} />
  </Route>
);

export default renderStaffRoutes;
