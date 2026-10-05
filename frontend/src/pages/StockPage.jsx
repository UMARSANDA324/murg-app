import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  Package,
  Plus,
  Edit2,
  Lock,
  Search,
  History,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  X,
  CheckCircle2,
  Printer,
  BarChart2,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Truck,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShoppingCart,
  RotateCcw,
} from 'lucide-react';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function StockPage() {
  const { activeBranch } = useBranchStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'movements'
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [movementOffset, setMovementOffset] = useState(0);
  const [hasMoreMovements, setHasMoreMovements] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Price Modal State (Admin Only)
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [newSelling, setNewSelling] = useState('');
  const [newBuying, setNewBuying] = useState('');
  const [newPricePerYard, setNewPricePerYard] = useState('');
  const [newYardsPerBelt, setNewYardsPerBelt] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [priceSaving, setPriceSaving] = useState(false);

  // Receive Stock Modal State (Supplier Intake)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveProduct, setReceiveProduct] = useState('');
  const [receiveStore, setReceiveStore] = useState('');
  const [receiveSupplier, setReceiveSupplier] = useState('');
  const [receiveUnit, setReceiveUnit] = useState('belt');
  const [receiveQty, setReceiveQty] = useState('');
  const [receiveCost, setReceiveCost] = useState('');
  const [receivePaid, setReceivePaid] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveSaving, setReceiveSaving] = useState(false);

  // Stock Tracking Modal State
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingStock, setTrackingStock] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState(null);
  const [trackingTab, setTrackingTab] = useState('history'); // 'history' | 'buyers'
  const [trackingFilters, setTrackingFilters] = useState({
    startDate: '', endDate: '', eventType: 'all', customer: '', staff: ''
  });
  const [trackingOffset, setTrackingOffset] = useState(0);
  const TRACKING_PAGE_SIZE = 50;

  useEffect(() => {
    if (activeBranch) {
      fetchStores();
      fetchStocks();
      if (activeTab === 'movements') {
        setMovementOffset(0);
        fetchMovements({ reset: true });
      }
    }
  }, [activeBranch, selectedStore, activeTab, debouncedSearch]);

  const fetchStores = async () => {
    try {
      const res = await api.get(`/stocks/stores?branchId=${activeBranch}`);
      setStores(res.data.data || []);
    } catch (err) {
      console.error('[Stock] Error fetching stores:', err);
    }
  };

  const fetchStocks = async () => {
    setLoading(true);
    try {
      let url = `/stocks?branchId=${activeBranch}`;
      if (selectedStore) url += `&storeId=${selectedStore}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      const res = await api.get(url);
      setStocks(res.data.data || []);
    } catch (err) {
      console.error('[Stock] Error fetching stocks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockTracking = async ({ stock, filters = trackingFilters, offset = 0 } = {}) => {
    const target = stock || trackingStock;
    if (!target) return;
    setTrackingLoading(true);
    setTrackingError(null);
    try {
      const params = new URLSearchParams({ branchId: activeBranch, limit: TRACKING_PAGE_SIZE, offset });
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.eventType && filters.eventType !== 'all') params.set('eventType', filters.eventType);
      if (filters.customer) params.set('customer', filters.customer);
      if (filters.staff) params.set('staff', filters.staff);
      const res = await api.get(`/stocks/${target.id || target._id}/tracking?${params.toString()}`);
      setTrackingData(res.data.data);
      setTrackingOffset(offset);
    } catch (err) {
      setTrackingError(err?.response?.data?.message || 'Failed to load tracking history.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const openTrackingModal = (stock) => {
    setTrackingStock(stock);
    setTrackingData(null);
    setTrackingError(null);
    setTrackingTab('history');
    setTrackingOffset(0);
    const defaultFilters = { startDate: '', endDate: '', eventType: 'all', customer: '', staff: '' };
    setTrackingFilters(defaultFilters);
    setTrackingModalOpen(true);
    fetchStockTracking({ stock, filters: defaultFilters, offset: 0 });
  };

  const fetchMovements = async ({ reset = false } = {}) => {
    try {
      const offset = reset ? 0 : movementOffset;
      const res = await api.get(`/stocks/movements?branchId=${activeBranch}&limit=500&offset=${offset}`);
      const nextMovements = res.data.data || [];
      setMovements(prev => reset ? nextMovements : [...prev, ...nextMovements]);
      setMovementOffset(offset + nextMovements.length);
      setHasMoreMovements(nextMovements.length === 500);
    } catch (err) {
      console.error('[Stock] Error fetching movements:', err);
    }
  };

  const loadMoreMovements = () => fetchMovements();

  const toggleDateExpansion = (dateStr) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr);
      } else {
        newSet.add(dateStr);
      }
      return newSet;
    });
  };

  const groupMovementsByDate = (movements) => {
    const grouped = {};
    movements.forEach(m => {
      const date = getBusinessDateKey(m.business_date || m.created_at, m.id);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(m);
    });
    return grouped;
  };

  const parseBusinessDate = (value) => {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value !== 'string' || !value.trim()) return null;

    const normalized = value.trim().replace(' ', 'T');
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    const parsed = new Date(
      dateOnly
        ? `${normalized}T00:00:00+01:00`
        : hasTimezone
          ? normalized
          : `${normalized}+01:00`
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getBusinessDateKey = (value, recordId) => {
    const parsed = parseBusinessDate(value);
    if (!parsed) {
      if (import.meta.env.DEV) {
        console.warn('[DATE_PARSE_WARNING]', {
          source: 'Stock Movement Ledger',
          field: 'business_date',
          recordId,
          reason: 'invalid_date',
        });
      }
      return 'unavailable';
    }

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed);
  };

  const formatBusinessDate = (date) => {
    if (date === 'unavailable') return 'Date unavailable';

    const parsed = parseBusinessDate(date);
    if (!parsed) return 'Date unavailable';

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(parsed);
  };

  const handleViewReceipt = async (orderID) => {
    setReceiptLoading(true);
    try {
      const res = await api.get(`/sales/${orderID}/receipt?branchId=${activeBranch}`);
      setReceiptData(res.data.data);
      setReceiptModalOpen(true);
    } catch (err) {
      alert('Failed to load receipt. The transaction may not exist or you may not have access.');
      console.error('[Stock] Error fetching receipt:', err);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleOpenPriceModal = (stock) => {
    if (!user?.isGlobalAdmin && user?.role !== 'Admin') {
      alert('Access Denied: Only Global Administrator is authorized to modify product prices.');
      return;
    }
    setSelectedStock(stock);
    setNewSelling(stock.selling);
    setNewBuying(stock.buying);
    setNewPricePerYard(stock.price_per_yard !== null && stock.price_per_yard !== undefined ? stock.price_per_yard : '');
    setNewYardsPerBelt(stock.yards_per_belt !== null && stock.yards_per_belt !== undefined ? stock.yards_per_belt : '100');
    setPriceReason('');
    setPriceModalOpen(true);
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    setPriceSaving(true);
    try {
      await api.patch(`/stocks/${selectedStock.id}/price?branchId=${activeBranch}`, {
        selling: parseFloat(newSelling),
        buying: parseFloat(newBuying),
        price_per_yard: newPricePerYard !== '' ? parseFloat(newPricePerYard) : null,
        yards_per_belt: newYardsPerBelt !== '' ? parseFloat(newYardsPerBelt) : null,
        reason: priceReason || 'Manual Admin Price Adjustment',
      });
      setPriceModalOpen(false);
      fetchStocks();
      alert('Product price and yard configuration updated successfully. Change logged in security audit.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update price.');
    } finally {
      setPriceSaving(false);
    }
  };

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    setReceiveSaving(true);
    try {
      await api.post(`/stocks/receive?branchId=${activeBranch}`, {
        stockId: receiveProduct,
        storeId: receiveStore || null,
        quantity: parseFloat(receiveQty),
        costPrice: parseFloat(receiveCost),
        purchaseFrom: receiveSupplier,
        forDesc: receiveNotes,
        amountPaid: parseFloat(receivePaid) || 0,
        unitType: receiveUnit,
      });

      setReceiveModalOpen(false);
      setReceiveSupplier('');
      setReceiveQty('');
      setReceiveCost('');
      setReceivePaid('');
      setReceiveNotes('');
      setReceiveUnit('belt');
      fetchStocks();
      alert('Stock receipt recorded and inventory updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record stock intake.');
    } finally {
      setReceiveSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0">Stock & Inventory Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track catalog inventory, supplier intakes, and audit movement ledgers for {activeBranch}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setReceiveModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Receive Supplier Stock</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-4">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-2 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'inventory'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Product Catalog & Balances
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-2 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'movements'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Ledger</span>
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search product catalog..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:w-56">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Stores/Warehouses</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    Store: {s.store_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">Store</th>
                  <th className="py-3 px-3">Unit</th>
                  <th className="py-3 px-3 text-right">Yds / Belt</th>
                  <th className="py-3 px-3 text-right">Available Qty</th>
                  <th className="py-3 px-3 text-right">Price / Yard</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-right">Buying Price</th>
                  <th className="py-3 px-3 text-center">Price Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocks.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-3 text-slate-500">{s.store_name || 'Main Warehouse'}</td>
                    <td className="py-3 px-3 capitalize font-medium text-slate-600">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${s.unit_type === 'yard' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {s.unit_type || 'belt'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-mono">
                      {s.yards_per_belt ? `${parseFloat(s.yards_per_belt)} yds` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded ${
                          s.quantity > 5 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {s.quantity} {s.unit_type === 'yard' ? 'yds' : 'belts'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-purple-700 font-mono">
                      {s.price_per_yard ? `₦${parseFloat(s.price_per_yard).toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-indigo-700">
                      ₦{s.selling.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500">
                      {s.buying !== undefined && s.buying !== null ? `₦${s.buying.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => openTrackingModal(s)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 py-1 px-2 rounded cursor-pointer"
                          title="View complete stock lifecycle history"
                        >
                          <BarChart2 className="w-3 h-3" />
                          <span>Track</span>
                        </button>
                        {user?.isGlobalAdmin || user?.role === 'Admin' ? (
                          <button
                            onClick={() => handleOpenPriceModal(s)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-1 px-2 rounded cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Price</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 py-0.5 px-2 rounded">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Admin Only</span>
                          </span>
                        )}
                      </div>

                    </td>
                  </tr>
                ))}
                {stocks.length === 0 && (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      No stock records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Movements Ledger Tab */}
      {activeTab === 'movements' && (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs print:overflow-visible">
          {Object.keys(groupMovementsByDate(movements)).length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-sans">
              No movement records logged yet.
            </div>
          ) : (
            Object.entries(groupMovementsByDate(movements)).map(([date, dateMovements]) => {
              const saleMovements = dateMovements.filter(m => m.movement_type === 'STOCK_OUT_SALE');
              const saleOrderIds = new Set(saleMovements.map(m => m.reference_id));
              const debtOrderIds = new Set(saleMovements.filter(m => m.is_credit).map(m => m.reference_id));
              const salesCount = saleOrderIds.size;
              const totalTransactions = saleOrderIds.size;
              const isExpanded = expandedDates.has(date);

              return (
                <div key={date} className="border-b border-slate-200 last:border-b-0">
                  {/* Date Group Header */}
                  <button
                    onClick={() => toggleDateExpansion(date)}
                    className="w-full bg-slate-50 hover:bg-slate-100 transition-colors py-3 px-4 flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">{formatBusinessDate(date)}</span>
                      <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                        {totalTransactions} transactions
                      </span>
                      {salesCount > 0 && (
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {salesCount - debtOrderIds.size} sales
                        </span>
                      )}
                      {debtOrderIds.size > 0 && (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {debtOrderIds.size} debt sales
                        </span>
                      )}
                    </div>
                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {/* Expanded Movements */}
                  {isExpanded && (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                          <th className="py-2 px-4">Time</th>
                          <th className="py-2 px-4">Product</th>
                          <th className="py-2 px-4">Event Type</th>
                          <th className="py-2 px-4 text-right">Change</th>
                          <th className="py-2 px-4 text-right">Before → After</th>
                          <th className="py-2 px-4">Performed By</th>
                          <th className="py-2 px-4">Notes</th>
                        <th className="py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {dateMovements.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-4 text-slate-500 font-sans">
                              {m.business_time || new Date(m.created_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-2 px-4 font-bold text-slate-900 font-sans">{m.product_name}</td>
                            <td className="py-2 px-4 font-sans">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  m.movement_type.includes('IN')
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {m.movement_type}
                              </span>
                            </td>
                            <td
                              className={`py-2 px-4 text-right font-bold ${
                                parseFloat(m.quantity_change) > 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {parseFloat(m.quantity_change) > 0 ? `+${m.quantity_change}` : m.quantity_change}
                            </td>
                            <td className="py-2 px-4 text-right text-slate-500">
                              {m.quantity_before} → {m.quantity_after}
                            </td>
                            <td className="py-2 px-4 text-slate-600 font-sans">{m.performed_by_name}</td>
                            <td className="py-2 px-4 text-slate-500 font-sans truncate max-w-xs">{m.notes}</td>
                            <td className="py-2 px-4">
                              {m.movement_type === 'STOCK_OUT_SALE' && m.reference_type === 'orders' && (
                                <button
                                  onClick={() => handleViewReceipt(m.reference_id)}
                                  disabled={receiptLoading}
                                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-1 px-2 rounded cursor-pointer disabled:opacity-50"
                                >
                                  View Receipt
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}
          {hasMoreMovements && (
            <div className="border-t border-slate-200 p-3 text-center">
              <button
                type="button"
                onClick={loadMoreMovements}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Load older movements
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin Price Update Modal */}
      {priceModalOpen && selectedStock && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setPriceModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">Admin Price Protection</h3>
                <p className="text-xs text-slate-500 m-0">Modifying price for {selectedStock.name}</p>
              </div>
            </div>

            <form onSubmit={handleSavePrice} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Selling Price (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newSelling}
                    onChange={(e) => setNewSelling(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Buying / Cost Price (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newBuying}
                    onChange={(e) => setNewBuying(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Price per Yard (₦)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 3500"
                    value={newPricePerYard}
                    onChange={(e) => setNewPricePerYard(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Yards per Belt (Ratio)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 100"
                    value={newYardsPerBelt}
                    onChange={(e) => setNewYardsPerBelt(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Reason for Price Adjustment (Mandatory for Audit Trail)
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="e.g. Supplier price increase, seasonal markdown"
                  value={priceReason}
                  onChange={(e) => setPriceReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={priceSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs"
                >
                  {priceSaving ? 'Recording Price Change...' : 'Confirm Price Update'}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Stock Receiving Modal */}
      {receiveModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-auto">
            <button
              onClick={() => setReceiveModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">Receive Stock from Supplier</h3>
            <p className="text-xs text-slate-500 mb-4">
              Record incoming goods, associate supplier details, and update inventory balances
            </p>

            <form onSubmit={handleReceiveStock} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Product *</label>
                <select
                  required
                  value={receiveProduct}
                  onChange={(e) => setReceiveProduct(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="">-- Choose Catalog Product --</option>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Current: {s.quantity} {s.unit_type || 'belt'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sub-Store Location</label>
                  <select
                    value={receiveStore}
                    onChange={(e) => setReceiveStore(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option value="">Main Store</option>
                    {stores.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.store_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Intake Unit *</label>
                  <select
                    value={receiveUnit}
                    onChange={(e) => setReceiveUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="belt">Belts (Wholesale)</option>
                    <option value="yard">Yards (Retail Cut)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 50"
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              {receiveUnit === 'belt' && receiveProduct && (
                (() => {
                  const selObj = stocks.find(s => String(s.id) === String(receiveProduct));
                  const ypb = selObj?.yards_per_belt || 100;
                  return (
                    <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900">
                      <span className="font-bold">Belt-to-Yard Conversion Preview: </span>
                      {receiveQty ? (
                        <span>
                          {receiveQty} Belts × {ypb} yds/belt = <strong className="text-indigo-700 font-black">{(parseFloat(receiveQty) * parseFloat(ypb)).toFixed(2)} Yards</strong> will be added to branch inventory.
                        </span>
                      ) : (
                        <span>Product ratio: {ypb} yards per belt.</span>
                      )}
                    </div>
                  );
                })()
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier / Dealer Name * ("Who supplied the stock?")
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alhaji Mustapha Fabrics, Kano"
                  value={receiveSupplier}
                  onChange={(e) => setReceiveSupplier(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Cost Price (₦) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 320000"
                    value={receiveCost}
                    onChange={(e) => setReceiveCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount Paid Immediately (₦)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={receivePaid}
                    onChange={(e) => setReceivePaid(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Invoice Reference</label>
                <input
                  type="text"
                  placeholder="Waybill No, bale numbers, or quality remarks"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={receiveSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs"
                >
                  {receiveSaving ? 'Recording Stock Receipt...' : 'Confirm Stock Receipt'}
                </button>
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal for Historical Transactions */}
      {receiptModalOpen && receiptData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setReceiptModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-600" />
              <span>Historical Receipt</span>
            </h3>

            {/* Thermal Receipt Content Container */}
            <div
              id="thermal-receipt"
              className="border border-slate-200 p-4 rounded-lg bg-slate-50 font-mono text-xs overflow-auto flex-1 text-slate-900"
            >
              {/* Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-400 mb-3">
                <h4 className="font-black text-sm uppercase m-0">MURG TEXTILE ENTERPRISES</h4>
                <p className="text-[11px] font-bold text-slate-700 m-0 mt-0.5">{receiptData.branch.name}</p>
                <p className="text-[10px] text-slate-600 m-0">{receiptData.branch.address}</p>
                <p className="text-[10px] text-slate-600 m-0">Tel: {receiptData.branch.phone || '08025493838'}</p>
              </div>

              {/* Meta */}
              <div className="space-y-0.5 text-[11px] mb-3 pb-2 border-b border-dashed border-slate-400">
                <div className="flex justify-between">
                  <span>Receipt No:</span>
                  <span className="font-bold">#{receiptData.order.orderID}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(receiptData.order.creation).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{receiptData.order.staff}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{receiptData.order.buyer_name}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-1 mb-3 pb-2 border-b border-dashed border-slate-400">
                {receiptData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate pr-2">
                      {item.item} x{item.quantity}
                    </span>
                    <span className="font-semibold">₦{item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-400">
                {receiptData.order.discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-₦{receiptData.order.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs pt-1">
                  <span>TOTAL PAID:</span>
                  <span>₦{receiptData.order.amount_paid.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment methods */}
              <div className="pt-2 text-[10px] text-slate-600 space-y-0.5">
                {receiptData.order.cash > 0 && <p className="m-0">Cash: ₦{receiptData.order.cash.toLocaleString()}</p>}
                {receiptData.order.pos > 0 && <p className="m-0">POS Card: ₦{receiptData.order.pos.toLocaleString()}</p>}
                {receiptData.order.transfer > 0 && (
                  <p className="m-0">
                    Transfer: ₦{receiptData.order.transfer.toLocaleString()} ({receiptData.order.bank_name || 'Bank'})
                  </p>
                )}
              </div>

              <div className="text-center pt-4 text-[10px] text-slate-500">
                <p className="m-0">Thank you for your business!</p>
                <p className="m-0 mt-1">REPRINT - Historical Record</p>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STOCK TRACKING MODAL ───────────────────────────────────── */}
      {trackingModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl relative my-4">

            {/* Header */}
            <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-emerald-100 p-2 rounded-xl flex-shrink-0">
                  <BarChart2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    {trackingData?.stock?.name || trackingStock?.name || 'Loading…'}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {trackingData?.stock?.code || '—'} &bull; {trackingData?.stock?.facilityID || ''} &bull; {trackingData?.stock?.store?.name || 'Main Warehouse'}
                  </p>
                </div>
              </div>
              <button onClick={() => setTrackingModalOpen(false)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stock Summary Cards */}
            {trackingData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-100 bg-slate-50">
                <div className="bg-white rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Current Stock</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{trackingData.summary.current_balance}</p>
                  <p className="text-[10px] text-slate-400">{trackingData.stock.unit_type}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-emerald-200">
                  <p className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">Total Received</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">+{trackingData.summary.total_received}</p>
                  <p className="text-[10px] text-slate-400">{trackingData.stock.unit_type}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-rose-200">
                  <p className="text-[10px] text-rose-700 font-medium uppercase tracking-wide">Total Sold/Out</p>
                  <p className="text-xl font-bold text-rose-700 mt-1">-{trackingData.summary.total_sold}</p>
                  <p className="text-[10px] text-slate-400">{trackingData.stock.unit_type}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-blue-200">
                  <p className="text-[10px] text-blue-700 font-medium uppercase tracking-wide">Unique Buyers</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{trackingData.summary.unique_buyers_count}</p>
                  <p className="text-[10px] text-slate-400">customers</p>
                </div>
                {!trackingData.summary.is_balance_exact && (
                  <div className="col-span-2 sm:col-span-4 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700">
                      Calculated balance ({trackingData.summary.calculated_balance} {trackingData.stock.unit_type}) differs from current stock ({trackingData.summary.current_balance} {trackingData.stock.unit_type}).
                      Pre-system historical opening balance may not be fully recorded.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-4 bg-white">
              <button
                onClick={() => setTrackingTab('history')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${trackingTab === 'history' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <History className="w-3 h-3 inline-block mr-1.5" />Transaction History
              </button>
              <button
                onClick={() => setTrackingTab('buyers')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${trackingTab === 'buyers' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Users className="w-3 h-3 inline-block mr-1.5" />Who Bought This? ({trackingData?.summary?.unique_buyers_count ?? '…'})
              </button>
            </div>

            {/* Filters (History tab only) */}
            {trackingTab === 'history' && (
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">From</label>
                  <input type="date" value={trackingFilters.startDate}
                    onChange={e => setTrackingFilters(f => ({ ...f, startDate: e.target.value }))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">To</label>
                  <input type="date" value={trackingFilters.endDate}
                    onChange={e => setTrackingFilters(f => ({ ...f, endDate: e.target.value }))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Event Type</label>
                  <select value={trackingFilters.eventType}
                    onChange={e => setTrackingFilters(f => ({ ...f, eventType: e.target.value }))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    <option value="all">All Events</option>
                    <option value="Received">Received</option>
                    <option value="Sold">Sold</option>
                    <option value="Returned">Returned</option>
                    <option value="Transferred Out">Transferred Out</option>
                    <option value="Transferred In">Transferred In</option>
                    <option value="Adjustment">Adjustment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Customer/Supplier</label>
                  <input type="text" placeholder="Search..." value={trackingFilters.customer}
                    onChange={e => setTrackingFilters(f => ({ ...f, customer: e.target.value }))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs w-28" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Staff</label>
                  <input type="text" placeholder="Search..." value={trackingFilters.staff}
                    onChange={e => setTrackingFilters(f => ({ ...f, staff: e.target.value }))}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs w-24" />
                </div>
                <button
                  onClick={() => { setTrackingOffset(0); fetchStockTracking({ filters: trackingFilters, offset: 0 }); }}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <Filter className="w-3 h-3" />Apply
                </button>
                <button
                  onClick={() => {
                    const df = { startDate: '', endDate: '', eventType: 'all', customer: '', staff: '' };
                    setTrackingFilters(df); setTrackingOffset(0);
                    fetchStockTracking({ filters: df, offset: 0 });
                  }}
                  className="inline-flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />Reset
                </button>
                {trackingData && (
                  <span className="text-[11px] text-slate-400 ml-auto self-center">
                    {trackingData.summary.filtered_count} events &bull; page {Math.floor(trackingOffset / TRACKING_PAGE_SIZE) + 1}
                  </span>
                )}
              </div>
            )}

            {/* Loading / Error */}
            {trackingLoading && (
              <div className="flex items-center justify-center py-12 text-slate-500 text-sm gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />Loading stock history…
              </div>
            )}
            {trackingError && !trackingLoading && (
              <div className="mx-4 my-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />{trackingError}
              </div>
            )}

            {/* ─ HISTORY TAB ─ */}
            {!trackingLoading && !trackingError && trackingData && trackingTab === 'history' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold tracking-wide">
                      <th className="py-2 px-3 text-left">Date / Time</th>
                      <th className="py-2 px-3 text-left">Event</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-left">Customer / Supplier</th>
                      <th className="py-2 px-3 text-left">Staff</th>
                      <th className="py-2 px-3 text-left">Reference</th>
                      <th className="py-2 px-3 text-left">Payment</th>
                      <th className="py-2 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trackingData.events.length === 0 && (
                      <tr><td colSpan="8" className="py-8 text-center text-slate-400">No events found for the selected filters.</td></tr>
                    )}
                    {trackingData.events.map((ev) => {
                      const isIn = ev.direction === 'IN';
                      const eventColors = {
                        'Received':         'bg-emerald-100 text-emerald-800',
                        'Sold':             'bg-rose-100 text-rose-800',
                        'Returned':         'bg-blue-100 text-blue-800',
                        'Transferred Out':  'bg-orange-100 text-orange-800',
                        'Transferred In':   'bg-teal-100 text-teal-800',
                        'Adjustment':       'bg-purple-100 text-purple-800',
                      };
                      const eventBadge = eventColors[ev.event_type] || 'bg-slate-100 text-slate-700';
                      const eventDate = new Date(ev.date);
                      const dateStr = eventDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                      const timeStr = eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <p className="font-semibold text-slate-800">{dateStr}</p>
                            <p className="text-[10px] text-slate-400">{timeStr}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${eventBadge}`}>
                              {isIn ? <ArrowDownCircle className="w-2.5 h-2.5" /> : <ArrowUpCircle className="w-2.5 h-2.5" />}
                              {ev.event_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={isIn ? 'text-emerald-700' : 'text-rose-700'}>
                              {isIn ? '+' : '-'}{ev.quantity}
                            </span>
                            <span className="text-slate-400 text-[10px] ml-0.5">{ev.unit}</span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[150px]">
                            {ev.customer_name ? (
                              <p className="font-semibold text-slate-800 truncate">{ev.customer_name}</p>
                            ) : ev.supplier_name ? (
                              <p className="text-slate-600 truncate flex items-center gap-1">
                                <Truck className="w-2.5 h-2.5 flex-shrink-0 text-slate-400" />{ev.supplier_name}
                              </p>
                            ) : (
                              <span className="text-slate-300 italic text-[10px]">unavailable</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {ev.staff_name || <span className="text-slate-300 italic text-[10px]">—</span>}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 max-w-[130px] truncate" title={ev.reference_id}>
                            {ev.reference_id}
                          </td>
                          <td className="py-2.5 px-3">
                            {ev.payment_method && ev.payment_method !== '—' ? (
                              <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                                ev.payment_method?.toLowerCase().includes('credit') ? 'bg-amber-100 text-amber-700' :
                                ev.payment_method?.toLowerCase().includes('split') ? 'bg-purple-100 text-purple-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{ev.payment_method}</span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            {ev.balance !== undefined ? ev.balance : <span className="text-slate-300 text-[10px]">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {trackingData.pagination && (trackingData.pagination.offset > 0 || trackingData.pagination.hasMore) && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                    <button
                      disabled={trackingOffset === 0 || trackingLoading}
                      onClick={() => { const newOffset = Math.max(0, trackingOffset - TRACKING_PAGE_SIZE); fetchStockTracking({ offset: newOffset }); }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />Previous
                    </button>
                    <span className="text-[11px] text-slate-500">
                      Showing {trackingOffset + 1}–{Math.min(trackingOffset + TRACKING_PAGE_SIZE, trackingData.pagination.total)} of {trackingData.pagination.total}
                    </span>
                    <button
                      disabled={!trackingData.pagination.hasMore || trackingLoading}
                      onClick={() => { const newOffset = trackingOffset + TRACKING_PAGE_SIZE; fetchStockTracking({ offset: newOffset }); }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─ BUYERS TAB ─ */}
            {!trackingLoading && !trackingError && trackingData && trackingTab === 'buyers' && (
              <div className="p-4">
                {trackingData.buyers.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">No buyer records found for this product.</div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500 mb-3">
                      {trackingData.buyers.length} customer{trackingData.buyers.length !== 1 ? 's' : ''} have purchased <strong>{trackingData.stock.name}</strong>
                    </p>
                    {trackingData.buyers.map((buyer, idx) => (
                      <div key={idx} className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${buyer.customer_name === 'Customer information unavailable' ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white hover:border-emerald-200 transition-colors'}`}>
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${buyer.customer_name === 'Customer information unavailable' ? 'bg-slate-200 text-slate-400' : 'bg-emerald-100 text-emerald-700'}`}>
                            {buyer.customer_name === 'Customer information unavailable' ? '?' : buyer.customer_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold truncate ${buyer.customer_name === 'Customer information unavailable' ? 'text-slate-400 italic text-xs' : 'text-slate-900 text-sm'}`}>
                              {buyer.customer_name}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              <span className="text-[10px] text-slate-500">
                                <ShoppingCart className="w-2.5 h-2.5 inline mr-0.5" />{buyer.orders_count} order{buyer.orders_count !== 1 ? 's' : ''}
                              </span>
                              {buyer.first_purchase_date && (
                                <span className="text-[10px] text-slate-500">
                                  First: {new Date(buyer.first_purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              {buyer.last_purchase_date && buyer.last_purchase_date !== buyer.first_purchase_date && (
                                <span className="text-[10px] text-slate-500">
                                  Last: {new Date(buyer.last_purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              {buyer.payment_methods.length > 0 && (
                                <span className="text-[10px] text-slate-400">{buyer.payment_methods.join(', ')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-slate-900">{buyer.total_quantity} <span className="text-[10px] font-normal text-slate-400">{trackingData.stock.unit_type}</span></p>
                          {buyer.total_spent > 0 && (
                            <p className="text-[10px] text-slate-500">₦{buyer.total_spent.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <button
                onClick={() => fetchStockTracking({ offset: trackingOffset })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />Refresh
              </button>
              <button
                onClick={() => setTrackingModalOpen(false)}
                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
