import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import { useAuthStore } from '../store/useAuthStore';
import { useBranchRealtime } from '../hooks/useBranchRealtime';
import {
  TrendingUp,
  Package,
  CreditCard,
  Truck,
  ShoppingCart,
  ArrowUpRight,
  Clock,
  Building2,
  Users,
  BarChart3,
} from 'lucide-react';

export default function DashboardPage() {
  const { activeBranch } = useBranchStore();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const fetchDashboard = useCallback(async (showLoading = true) => {
    if (!activeBranch) return;
    if (showLoading) setLoading(true);
    try {
      const res = await api.get(`/branches/${activeBranch}/dashboard`);
      setData(res.data.data);
      setError(null);
    } catch (err) {
      console.error('[Dashboard] Error fetching metrics:', err);
      setError(err.response?.data?.message || 'Dashboard data could not be loaded.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeBranch]);

  useEffect(() => {
    if (activeBranch) {
      fetchDashboard(true);
      fetchAnalytics();
    }
  }, [activeBranch, fetchDashboard]);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get(`/analytics/sales-activity?branchId=${activeBranch}`);
      setAnalytics(res.data.data);
    } catch (err) {
      console.error('[Dashboard] Error fetching analytics:', err);
    }
  };

  const handleRealtimeUpdate = useCallback(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);
  const realtime = useBranchRealtime(activeBranch, handleRealtimeUpdate);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const branch = data?.branch || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={`inline-flex items-center gap-2 ${realtime.status === 'connected' ? 'text-emerald-700' : 'text-amber-700'}`}>
          <span className={`h-2 w-2 rounded-full ${realtime.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {realtime.status === 'connected' ? 'Live updates connected' : 'Reconnecting live updates'}
        </span>
        {realtime.error && <span className="text-amber-700">{realtime.error}</span>}
      </div>
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
              Operational Branch
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                branch.sales_mode === 'PER_YARD'
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30'
                  : 'bg-blue-500/30 text-blue-200 border border-blue-400/30'
              }`}
            >
              {branch.sales_mode === 'PER_YARD' ? 'PER YARD RETAIL' : 'DEALER / BELT'}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white m-0">
            {branch.name || activeBranch}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {branch.address || 'Kano Central Market, Nigeria'} • Code: {branch.facilityID}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/pos"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Open POS Cashier</span>
          </Link>
          <Link
            to="/stock"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Stock Inventory</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* DAS - Daily Active Sales */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">DAS</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {analytics?.das || 0}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span>Daily Active Sales</span>
          </div>
        </div>

        {/* WAS - Weekly Active Sales */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">WAS</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {analytics?.was || 0}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span>Weekly Active Sales</span>
          </div>
        </div>

        {/* MAS - Monthly Active Sales */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">MAS</span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {analytics?.mas || 0}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span>Monthly Active Sales</span>
          </div>
        </div>
      </div>

      {/* Original Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today's Sales */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Today's Sales</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              ₦{(metrics.today_sales?.net_sales || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
            <div>{metrics.today_sales?.order_count || 0} orders completed</div>
            <div className="text-[10px] text-slate-400">
              Cash: ₦{(metrics.today_sales?.cash_sales || 0).toLocaleString()} • Credit: ₦{(metrics.today_sales?.credit_sales || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Stock Valuation & Physical Units */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Stock Inventory</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              ₦{(metrics.stock?.total_value || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span className="font-bold text-indigo-700">{metrics.stock?.total_quantity || 0} {metrics.unit_label || 'Units'}</span>
            <span className="text-slate-400"> across {metrics.stock?.total_products || 0} items</span>
          </div>
        </div>

        {/* Outstanding Debts */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Customer Debts</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              ₦{(metrics.debts?.total_outstanding || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span>{metrics.debts?.debtor_count || 0} debtors with active balance</span>
          </div>
        </div>

        {/* In-Transit Transfers */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">In-Transit Goods</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {metrics.shipments?.in_transit || 0} <span className="text-xs font-normal text-slate-400">shipments</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span>In: {metrics.shipments?.incoming_shipments || 0} ({metrics.shipments?.incoming_units || 0}u) • Out: {metrics.shipments?.outgoing_shipments || 0}</span>
          </div>
        </div>

        {/* Received Today */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Received Today</span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {metrics.received_today?.total_units || 0} <span className="text-xs font-normal text-slate-400">{metrics.unit_label || 'Units'}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span>Supplier: {metrics.received_today?.supplier_units || 0} • Transfers: {metrics.received_today?.transfer_units || 0}</span>
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Isolation Notice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 m-0">Operations Launchpad</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              to="/pos"
              className="p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col justify-between"
            >
              <ShoppingCart className="w-5 h-5 text-indigo-600 mb-2" />
              <div>
                <p className="text-sm font-semibold text-slate-800 m-0">POS Terminal</p>
                <p className="text-xs text-slate-500 m-0">Process direct & split sales</p>
              </div>
            </Link>

            <Link
              to="/stock"
              className="p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col justify-between"
            >
              <Package className="w-5 h-5 text-indigo-600 mb-2" />
              <div>
                <p className="text-sm font-semibold text-slate-800 m-0">Receive Stock</p>
                <p className="text-xs text-slate-500 m-0">Record incoming supplier goods</p>
              </div>
            </Link>

            <Link
              to="/shipments"
              className="p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col justify-between"
            >
              <Truck className="w-5 h-5 text-indigo-600 mb-2" />
              <div>
                <p className="text-sm font-semibold text-slate-800 m-0">Stock Transfers</p>
                <p className="text-xs text-slate-500 m-0">Dispatch & receive between branches</p>
              </div>
            </Link>

            <Link
              to="/customers"
              className="p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col justify-between"
            >
              <CreditCard className="w-5 h-5 text-indigo-600 mb-2" />
              <div>
                <p className="text-sm font-semibold text-slate-800 m-0">Debt Collections</p>
                <p className="text-xs text-slate-500 m-0">Record customer deposits</p>
              </div>
            </Link>

            {user?.isGlobalAdmin && (
              <Link
                to="/staff"
                className="p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col justify-between"
              >
                <Users className="w-5 h-5 text-indigo-600 mb-2" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 m-0">Manage Staff</p>
                  <p className="text-xs text-slate-500 m-0">Assign staff & roles to branches</p>
                </div>
              </Link>
            )}

            {user?.isGlobalAdmin && (
              <Link
                to="/branches"
                className="p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col justify-between"
              >
                <Building2 className="w-5 h-5 text-indigo-600 mb-2" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 m-0">Branch Control</p>
                  <p className="text-xs text-slate-500 m-0">Create & activate branches</p>
                </div>
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 m-0 mb-2">Branch Security & Isolation</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              All transactions, inventory counts, customer debts, and sales figures on this dashboard are strictly scoped to <strong>{branch.name} ({activeBranch})</strong>.
            </p>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800 space-y-1">
              <p className="font-semibold m-0">Backend Enforcement:</p>
              <p className="m-0">Database queries automatically inject parameterized branch identifiers. URL tampering is rejected with 403 Forbidden.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Branch Status: <span className="text-emerald-600 font-bold uppercase">{branch.status || 'Active'}</span></span>
            <span>Staff On Duty: {metrics.staff?.active_count || 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
