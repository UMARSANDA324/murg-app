import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useBranchStore } from '../store/useBranchStore';
import api from '../services/api';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  Building2,
  UserCheck,
  LogOut,
  ExternalLink,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  Bell,
  FileCheck2,
  CheckCircle2,
  PackageCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';

// ─── Notification type → icon + nav destination ───────────────────────────────
function getNotifMeta(type) {
  switch (type) {
    case 'GOODS_REQUEST':
      return { icon: FileCheck2, color: 'bg-indigo-100 text-indigo-600', path: '/goods-requests' };
    case 'GOODS_REQUEST_APPROVED':
      return { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', path: '/goods-requests' };
    case 'GOODS_REQUEST_REJECTED':
      return { icon: AlertTriangle, color: 'bg-rose-100 text-rose-600', path: '/goods-requests' };
    case 'GOODS_RELEASED':
      return { icon: PackageCheck, color: 'bg-teal-100 text-teal-600', path: '/goods-requests' };
    case 'SHIPMENT_DISPATCHED':
      return { icon: Truck, color: 'bg-blue-100 text-blue-600', path: '/shipments' };
    default:
      return { icon: Info, color: 'bg-slate-100 text-slate-500', path: '/goods-requests' };
  }
}

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { branches, activeBranch, activeBranchData, fetchBranches, setActiveBranch } = useBranchStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Notification Bell State ───────────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  // Ref for click-outside detection
  const notifRef = useRef(null);

  // ── Fetch notifications + unread count ────────────────────────────────────
  const fetchNotificationData = useCallback(async () => {
    try {
      const [countRes, listRes] = await Promise.all([
        api.get('/notifications/unread-count'),
        api.get('/notifications?limit=15'),
      ]);
      setUnreadCount(countRes.data.data?.unreadCount || 0);
      setNotifications(listRes.data.data || []);
    } catch (_) {
      // Quiet fail — polling will retry
    }
  }, []);

  useEffect(() => {
    fetchBranches();
    fetchNotificationData();

    // Poll unread count every 30 seconds to catch new notifications from other sessions
    const interval = setInterval(fetchNotificationData, 30000);
    return () => clearInterval(interval);
  }, [fetchBranches, fetchNotificationData]);

  // ── Click-outside closes the dropdown ─────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    }
    if (notifDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifDropdownOpen]);

  /**
   * PART 1 — Automatic mark-as-read when the bell is opened.
   *
   * When the panel opens:
   * 1. Fetch fresh notifications.
   * 2. Collect IDs of unread notifications currently visible.
   * 3. POST /api/notifications/mark-read with those IDs.
   * 4. Backend enforces ownership — only marks notifications belonging to req.user.
   * 5. Update local state immediately so the bell count drops without a round-trip.
   *
   * This is idempotent: opening the panel again when all are already read is a no-op.
   */
  const openNotificationPanel = useCallback(async () => {
    const opening = !notifDropdownOpen;
    setNotifDropdownOpen(opening);

    if (!opening) return; // closing — nothing to do

    // Step 1: Fetch fresh notifications
    let freshNotifications = notifications;
    try {
      const [countRes, listRes] = await Promise.all([
        api.get('/notifications/unread-count'),
        api.get('/notifications?limit=15'),
      ]);
      freshNotifications = listRes.data.data || [];
      setNotifications(freshNotifications);
      setUnreadCount(countRes.data.data?.unreadCount || 0);
    } catch (_) {
      // Use cached state if fetch fails
    }

    // Step 2: Find unread IDs from what is currently displayed
    const unreadIds = freshNotifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);

    if (unreadIds.length === 0) return; // Nothing to mark

    // Step 3: Batch mark as read via backend
    setMarkingRead(true);
    try {
      const res = await api.post('/notifications/mark-read', { ids: unreadIds });
      const newUnreadCount = res.data.data?.unreadCount ?? 0;

      // Step 4: Update local state immediately
      setUnreadCount(newUnreadCount);
      setNotifications((prev) =>
        prev.map((n) =>
          unreadIds.includes(n.id) ? { ...n, is_read: 1 } : n
        )
      );
    } catch (_) {
      // Non-fatal — the backend will still update on next poll
    } finally {
      setMarkingRead(false);
    }
  }, [notifDropdownOpen, notifications]);

  /**
   * Mark ALL notifications as read (explicit "Mark all as read" button).
   * Returns updated count from backend.
   */
  const handleMarkAllRead = async () => {
    try {
      const res = await api.post('/notifications/mark-all-read');
      const newCount = res.data.data?.unreadCount ?? 0;
      setUnreadCount(newCount);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('[Notifications] Failed to mark all as read:', err.message);
    }
  };

  /**
   * Navigate to the appropriate page when a notification item is clicked.
   * Marks the individual notification as read first (optimistic update).
   */
  const handleNotificationClick = async (notif) => {
    setNotifDropdownOpen(false);

    // Optimistically update if still unread
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Fire-and-forget individual mark-as-read (idempotent)
      api.patch(`/notifications/${notif.id}/read`).catch(() => {});
    }

    const meta = getNotifMeta(notif.type);
    navigate(meta.path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'POS Terminal', path: '/pos', icon: ShoppingCart },
    { label: 'Stock & Inventory', path: '/stock', icon: Package },
    { label: 'Shipments & Transfers', path: '/shipments', icon: Truck },
    { label: 'Goods Requests', path: '/goods-requests', icon: FileCheck2 },
    { label: 'Customers & Debts', path: '/customers', icon: Users },
  ];

  if (user?.isGlobalAdmin || user?.role === 'Admin') {
    navItems.push({ label: 'Staff & Roles', path: '/staff', icon: UserCheck });
    navItems.push({ label: 'Branch Management', path: '/branches', icon: Building2 });
    navItems.push({ label: 'Management', path: '/management', icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row print:block">
      {/* ── Sidebar (Desktop) ────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-100 p-4 border-r border-slate-800 shrink-0 print:hidden">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-800 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xl shadow-md">
            M
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white m-0">MURG TEXTILE</h1>
            <p className="text-xs text-slate-400 m-0">Retail &amp; Wholesale</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer: Legacy link + Sign out */}
        <div className="pt-4 border-t border-slate-800 mt-auto space-y-2">
          <a
            href="/system"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <span>Legacy PHP System</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs print:hidden">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Branch Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 hidden sm:inline">
              Branch:
            </span>
            {user?.isGlobalAdmin ? (
              <div className="relative">
                <select
                  value={activeBranch || ''}
                  onChange={(e) => setActiveBranch(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-semibold py-1.5 px-3 pr-8 rounded-md border border-slate-300 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.facilityID} value={b.facilityID}>
                      {b.name} ({b.facilityID})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-md text-xs border border-indigo-200">
                <Building2 className="w-3.5 h-3.5" />
                <span>{activeBranchData?.name || user?.facilityID}</span>
              </div>
            )}
          </div>

          {/* Right: Bell + User */}
          <div className="flex items-center gap-3">
            {/* ── Notification Bell ──────────────────────────────────────────── */}
            <div className="relative" ref={notifRef}>
              <button
                id="notification-bell-btn"
                onClick={openNotificationPanel}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Notifications"
                aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
                aria-expanded={notifDropdownOpen}
                aria-haspopup="true"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse"
                    aria-live="polite"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* ── Notification Dropdown ────────────────────────────────────── */}
              {notifDropdownOpen && (
                <div
                  id="notification-dropdown"
                  className="absolute right-0 mt-2 w-[320px] sm:w-[400px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-xs"
                  role="dialog"
                  aria-label="Notifications panel"
                >
                  {/* Panel header */}
                  <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                          {unreadCount} unread
                        </span>
                      )}
                      {markingRead && (
                        <span className="text-[10px] text-slate-400 italic">marking read…</span>
                      )}
                    </div>
                    {/* Manual "Mark all as read" button — still shows if somehow missed */}
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-indigo-600 font-semibold hover:underline cursor-pointer whitespace-nowrap"
                        title="Mark all as read"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div
                    className="max-h-[360px] overflow-y-auto divide-y divide-slate-100"
                    role="list"
                    aria-label="Notification items"
                  >
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium">No notifications yet.</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const meta = getNotifMeta(n.type);
                        const Icon = meta.icon;
                        const isUnread = !n.is_read;
                        return (
                          <div
                            key={n.id}
                            id={`notif-item-${n.id}`}
                            role="listitem"
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex gap-3 ${
                              isUnread ? 'bg-indigo-50/50' : 'opacity-75'
                            }`}
                          >
                            {/* Type icon */}
                            <div className={`w-7 h-7 rounded-lg ${meta.color} flex items-center justify-center shrink-0 mt-0.5`}>
                              <Icon className="w-4 h-4" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`m-0 truncate leading-tight ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                  {n.title}
                                </p>
                                {isUnread && (
                                  <span className="w-2 h-2 bg-indigo-600 rounded-full shrink-0 mt-1.5 flex-shrink-0" aria-label="Unread" />
                                )}
                              </div>
                              <p className="text-slate-500 m-0 mt-0.5 leading-relaxed line-clamp-2 whitespace-pre-line">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-slate-400 m-0 mt-1 block">
                                {new Date(n.created_at).toLocaleString('en-GB')}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Panel footer */}
                  <div className="p-2 border-t border-slate-200 bg-slate-50 text-center">
                    <Link
                      to="/goods-requests"
                      onClick={() => setNotifDropdownOpen(false)}
                      className="text-xs font-bold text-indigo-600 hover:underline inline-block py-1"
                    >
                      View All Goods Requests →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight m-0">{user?.name}</p>
                <span
                  className={`inline-block text-[11px] font-bold px-1.5 rounded ${
                    user?.role === 'Admin'
                      ? 'bg-purple-100 text-purple-700'
                      : user?.role === 'Sub-admin'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {user?.role === 'Admin'
                    ? 'Global Admin'
                    : user?.role === 'Sub-admin'
                    ? 'Branch Manager'
                    : 'Cashier'}
                </span>
              </div>

              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm select-none">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 text-slate-100 p-4 border-b border-slate-800 space-y-2 print:hidden">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-800"
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-slate-800 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
