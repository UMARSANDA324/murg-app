import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useBranchRealtime } from '../hooks/useBranchRealtime';
import {
  ShieldCheck,
  Building2,
  Users,
  Package,
  Truck,
  DollarSign,
  ShoppingCart,
  Receipt,
  FileText,
  Warehouse,
  RotateCcw,
  Activity,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  Layers,
  Server,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

export default function ManagementPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'legacy', 'audit'
  const [overview, setOverview] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [launchingModule, setLaunchingModule] = useState(null);
  const [bridgeError, setBridgeError] = useState(null);
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const fetchOverview = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await api.get('/management/overview');
      setOverview(res.data.data);
    } catch (err) {
      console.error('Failed to load management overview:', err);
      setError('Unable to load management overview. Please try again.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchAuditLogs = async (action = '') => {
    try {
      const url = action ? `/management/audit-logs?action=${action}` : '/management/audit-logs';
      const res = await api.get(url);
      setAuditLogs(res.data.data.logs || []);
      setAuditTotal(res.data.data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchAuditLogs();
  }, []);

  const managementBranchIds = overview?.branches?.list?.map((branch) => branch.facilityID) || [];
  useBranchRealtime(managementBranchIds, () => fetchOverview(false));

  const handleLaunchLegacy = async (targetPath, title) => {
    setLaunchingModule(title);
    setBridgeError(null);
    try {
      const res = await api.post('/management/bridge-ticket', { targetPath });
      const { bridgeUrl } = res.data.data;
      window.open(bridgeUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Bridge ticket failed:', err);
      const msg = err.response?.data?.message || 'Failed to authenticate legacy session.';
      setBridgeError(`Error launching ${title}: ${msg}`);
    } finally {
      setLaunchingModule(null);
    }
  };

  const legacyModules = [
    {
      title: 'Expense Management',
      path: '/system/expense.php',
      desc: 'Record branch overheads, utilities, logistics and daily operational expenses.',
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
    {
      title: 'Bank Deposits & Accounts',
      path: '/system/deposit.php',
      desc: 'Manage bank lodgments, customer account balances and deposit slips.',
      icon: Receipt,
      color: 'bg-blue-500',
    },
    {
      title: 'Supplier Purchases & Orders',
      path: '/system/purchase.php',
      desc: 'Purchase order processing, invoice attachments and supplier payables.',
      icon: ShoppingCart,
      color: 'bg-purple-500',
    },
    {
      title: 'Store & Warehouse Setup',
      path: '/system/store.php',
      desc: 'Configure physical storage sections, aisles and bulk storage racks.',
      icon: Warehouse,
      color: 'bg-amber-500',
    },
    {
      title: 'Product Returns',
      path: '/system/return.php',
      desc: 'Process damaged fabric claims, customer returns and stock reversals.',
      icon: RotateCcw,
      color: 'bg-rose-500',
    },
    {
      title: 'Legacy Comprehensive Reports',
      path: '/system/report.php',
      desc: 'Audited monthly financial summaries, sales history and ledger reconciliation.',
      icon: FileText,
      color: 'bg-indigo-500',
    },
  ];

  const modernModules = [
    {
      title: 'Branch Management',
      path: '/branches',
      desc: 'Create branches, toggle Dealer vs Per-Yard sales mode, assign locations.',
      icon: Building2,
      badge: `${overview?.branches?.active || 0} Active`,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      title: 'Staff & Roles',
      path: '/staff',
      desc: 'User account creation, role assignments (Admin / Staff), security status.',
      icon: Users,
      badge: `${overview?.staff?.total || 0} Staff`,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      title: 'Stock & Pricing Control',
      path: '/stock',
      desc: 'Catalog inventory, per-yard pricing overrides, belt-to-yard stock intake.',
      icon: Package,
      badge: `${(overview?.inventory?.total_products || 0).toLocaleString()} SKUs`,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Shipments & Logistics',
      path: '/shipments',
      desc: 'Inter-branch stock transfers, dispatch locks, receiving confirmations.',
      icon: Truck,
      badge: `${overview?.shipments?.in_transit || 0} In Transit`,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      title: 'Customers & Debts',
      path: '/customers',
      desc: 'Customer credit limits, outstanding ledger balances, debt collections.',
      icon: DollarSign,
      badge: `₦${(overview?.debts?.total_balance || 0).toLocaleString()}`,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      title: 'POS Terminal',
      path: '/pos',
      desc: 'Point of sale terminal for retail per-yard and wholesale belt checkouts.',
      icon: ShoppingCart,
      badge: 'Active Terminal',
      color: 'text-cyan-600 bg-cyan-50',
    },
  ];

  // Helper for formatting currency safely
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `₦${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse flex items-center justify-between">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-8 bg-slate-200 rounded w-24"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 h-36 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center text-rose-700 space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
        <div>
          <h3 className="text-base font-bold">Unable to load management overview</h3>
          <p className="text-xs text-rose-600 mt-1">Please try again or check backend services.</p>
        </div>
        <button
          onClick={fetchOverview}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading Overview</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 m-0">Admin Management Overview</h1>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                All Authorized Branches
              </span>
            </div>
            <p className="text-xs text-slate-500 m-0 mt-1">
              Consolidated real-time operational dashboard for MURG Textile Enterprises across all branch networks.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchOverview();
            fetchAuditLogs(auditActionFilter);
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {bridgeError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{bridgeError}</span>
        </div>
      )}

      {/* Main Required Business Metrics Overview Grid (6 Core Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Today's Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 w-full overflow-hidden hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Today's Sales
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words min-w-0 leading-tight">
              {formatCurrency(overview?.todaySales?.total)}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Today's Orders:</span>
              <span className="font-bold text-slate-800">{overview?.todaySales?.count || 0} checkout(s)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Stock Inventory */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 w-full overflow-hidden hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Stock Inventory
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words min-w-0 leading-tight">
              {(overview?.inventory?.total_products || 0).toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">SKUs</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Total Network Volume:</span>
              <span className="font-bold text-slate-800">
                {(overview?.inventory?.total_units || 0).toLocaleString()} units / yards
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Customers */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 w-full overflow-hidden hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Customers
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words min-w-0 leading-tight">
              {(overview?.customers?.total || 0).toLocaleString()}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Network Base:</span>
              <span className="font-bold text-slate-800">Deduplicated across branches</span>
            </div>
          </div>
        </div>

        {/* Card 4: In-Transit Goods */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 w-full overflow-hidden hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              In-Transit Goods
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight break-words min-w-0 leading-tight">
              {overview?.shipments?.in_transit || 0}{' '}
              <span className="text-sm font-normal text-slate-500">shipments</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Status:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                Pending Branch Receipt
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Received Today */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 w-full overflow-hidden hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Received Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words min-w-0 leading-tight">
              {overview?.shipments?.received_today || 0}{' '}
              <span className="text-sm font-normal text-slate-500">shipments</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Historical Total:</span>
              <span className="font-bold text-slate-800">
                {overview?.shipments?.received || 0} received to date
              </span>
            </div>
          </div>
        </div>

        {/* Card 6: Outstanding Debts (CRITICAL: Must NEVER overflow) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between min-w-0 w-full overflow-hidden hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Outstanding Debts
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight break-words min-w-0 leading-tight">
              {formatCurrency(overview?.debts?.total_balance)}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Active Debtors:</span>
              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                {overview?.debts?.debtor_count || 0} customer(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation for Admin Modules & System Logs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl overflow-x-auto min-w-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Management Command Center</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Security & Audit Trail</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-100 text-purple-700">
            {auditTotal}
          </span>
        </button>
      </div>

      {/* Tab 1: Core Administration Command Center & Network Details */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive Branch & Network Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 m-0 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Branch Network Overview</span>
              <span className="text-xs font-semibold text-slate-500">
                ({overview?.branches?.active || 0} active / {overview?.branches?.total || 0} total)
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {overview?.branches?.list?.map((b) => (
                <div key={b.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate">{b.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Facility ID: <code className="font-mono text-slate-700">{b.facilityID}</code></span>
                    <span className="font-semibold text-indigo-600">{b.sales_mode}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Access to Core Admin Modules */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Administrative Modules</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modernModules.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.title}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all group min-w-0"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.color} shrink-0`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 truncate max-w-[140px]">
                          {m.badge}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 m-0 group-hover:text-indigo-600 transition-colors">
                        {m.title}
                      </h3>
                      <p className="text-xs text-slate-500 m-0 mt-1 line-clamp-2 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <Link
                        to={m.path}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span>Manage {m.title}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 m-0">Live Audit Trail</h3>
              <span className="text-xs text-slate-500">({auditTotal} events recorded)</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  fetchAuditLogs(e.target.value);
                }}
                className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 cursor-pointer"
              >
                <option value="">All Actions</option>
                <option value="UNAUTHORIZED_PRICE_CHANGE_ATTEMPT">Unauthorized Price Attempts</option>
                <option value="LOGIN">Logins</option>
                <option value="STOCK_OUT_TRANSFER">Shipment Dispatches</option>
                <option value="STOCK_IN_TRANSFER">Shipment Receipts</option>
                <option value="STOCK_IN_SUPPLIER">Stock Intakes</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Branch</th>
                  <th className="py-2.5 px-4">Target Entity</th>
                  <th className="py-2.5 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No audit events matching criteria.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const isAlert = log.action.includes('UNAUTHORIZED') || log.action.includes('REJECT');
                    return (
                      <tr key={log.id} className={isAlert ? 'bg-rose-50/50' : 'hover:bg-slate-50/60'}>
                        <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              isAlert
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {log.user_name}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {log.facilityID || 'Global'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {log.entity_type} #{log.entity_id}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">
                          {log.ip_address || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
