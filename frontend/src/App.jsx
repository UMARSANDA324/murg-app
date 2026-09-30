import React, { useEffect } from 'react';
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
import ExpensesPage from './pages/ExpensesPage';
import ReturnsPage from './pages/ReturnsPage';
import NotFoundPage from './pages/NotFoundPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { authReady, isAuthenticated, user } = useAuthStore();

  if (!authReady) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !user?.isGlobalAdmin && user?.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const { authReady, authError, isAuthenticated, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (!authReady && authError) {
    return (
      <div role="alert" className="min-h-screen grid place-items-center p-6">
        <div className="text-center">
          <p>{authError}</p>
          <button type="button" onClick={restoreSession}>Retry</button>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return <div role="status" className="min-h-screen grid place-items-center">Restoring session...</div>;
  }

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
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<POSTerminalPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="shipments" element={<ShipmentsPage />} />
          <Route path="goods-requests" element={<GoodsRequestsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="returns" element={<ReturnsPage />} />
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

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
