import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import POSTerminalPage from './pages/POSTerminalPage';
import StockPage from './pages/StockPage';
import ShipmentsPage from './pages/ShipmentsPage';
import GoodsRequestsPage from './pages/GoodsRequestsPage';
import CustomersPage from './pages/CustomersPage';
import StaffPage from './pages/StaffPage';
import BranchesPage from './pages/BranchesPage';
import ManagementPage from './pages/ManagementPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !user?.isGlobalAdmin && user?.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<POSTerminalPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="shipments" element={<ShipmentsPage />} />
          <Route path="goods-requests" element={<GoodsRequestsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route
            path="management"
            element={
              <ProtectedRoute adminOnly>
                <ManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="staff"
            element={
              <ProtectedRoute adminOnly>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="branches"
            element={
              <ProtectedRoute adminOnly>
                <BranchesPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
