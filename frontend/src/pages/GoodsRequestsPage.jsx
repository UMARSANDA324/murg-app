import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import {
  Package,
  Plus,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  AlertCircle,
  RefreshCw,
  Search,
  ChevronRight,
  ShieldAlert,
  FileCheck2,
  FileText,
  User,
  ArrowRight,
  X,
  QrCode,
  PenLine,
  BookOpen,
  ChevronDown,
  Printer,
  Star,
  Box,
  BadgeCheck,
} from 'lucide-react';

// ─── Debounce helper ──────────────────────────────────────────────────────────
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PENDING: { cls: 'bg-amber-100 text-amber-800 border-amber-200', label: 'PENDING' },
    APPROVED: { cls: 'bg-indigo-100 text-indigo-800 border-indigo-200', label: 'APPROVED' },
    RELEASED: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'RELEASED' },
    REJECTED: { cls: 'bg-rose-100 text-rose-800 border-rose-200', label: 'REJECTED' },
    CANCELLED: { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: 'CANCELLED' },
    SHIPPING_CREATED: { cls: 'bg-blue-100 text-blue-800 border-blue-200', label: 'SHIPPING' },
    IN_TRANSIT: { cls: 'bg-blue-100 text-blue-800 border-blue-200', label: 'IN TRANSIT' },
    RECEIVED: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'RECEIVED' },
  };
  const s = map[status] || { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: status };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── ProductSourceBadge ───────────────────────────────────────────────────────
function ProductSourceBadge({ source }) {
  if (source === 'CUSTOM') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <PenLine className="w-2.5 h-2.5" /> CUSTOM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
      <BookOpen className="w-2.5 h-2.5" /> CATALOG
    </span>
  );
}

// ─── CatalogSearchCombobox ────────────────────────────────────────────────────
function CatalogSearchCombobox({ onSelect, onManualEntry }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const debouncedQuery = useDebounce(query, 350);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      fetchCatalog('');
      return;
    }
    fetchCatalog(debouncedQuery);
  }, [debouncedQuery]);

  useEffect(() => {
    fetchCatalog('');
  }, []);

  const fetchCatalog = async (search) => {
    setSearching(true);
    try {
      const params = search.trim() ? `?search=${encodeURIComponent(search)}&limit=50` : '?limit=50';
      const res = await api.get(`/stocks/catalog${params}`);
      const data = res.data.data || [];
      setResults(data);
      setNoResults(search.trim() !== '' && data.length === 0);
    } catch (err) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (product) => {
    onSelect(product);
    setQuery(product.name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search product catalog..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setNoResults(false); }}
          onFocus={() => setOpen(true)}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2.5 pl-8 pr-8 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          autoComplete="off"
        />
        {searching && <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-500 animate-spin pointer-events-none" />}
        {!searching && query && (
          <button type="button" onClick={() => { setQuery(''); setResults([]); setNoResults(false); onSelect(null); setOpen(false); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {results.length > 0 ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50">
                Global Catalog — {results.length} product{results.length !== 1 ? 's' : ''}
              </div>
              {results.map((product) => (
                <button key={`${product.id}-${product.name}`} type="button" onClick={() => handleSelect(product)} className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between group transition-colors">
                  <span className="font-semibold text-slate-800 group-hover:text-indigo-800">{product.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">{product.unit_type}</span>
                </button>
              ))}
              <button type="button" onClick={() => { setOpen(false); onManualEntry(query); }} className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 border-t border-slate-100 flex items-center gap-1.5">
                <PenLine className="w-3 h-3" />
                <span>Enter <strong>"{query || 'product'}"</strong> as a custom request instead</span>
              </button>
            </>
          ) : noResults ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-500 mb-2">No catalog product found for <strong>"{query}"</strong></p>
              <button type="button" onClick={() => { setOpen(false); onManualEntry(query); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold text-xs rounded-lg transition-colors">
                <PenLine className="w-3 h-3" /> Request as custom product
              </button>
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">
              {searching ? 'Searching...' : 'Type to search the global product catalog'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Approval Receipt Print View ──────────────────────────────────────────────
function ApprovalReceiptPrint({ request, onClose }) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 z-10 print:hidden">
          <X className="w-5 h-5" />
        </button>

        {/* Print area */}
        <div id="approval-receipt-print" className="p-6">
          <div className="text-center border-b border-slate-200 pb-4 mb-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">MURG TEXTILE ENTERPRISES</div>
            <h2 className="text-base font-bold text-slate-900">GOODS COLLECTION RECEIPT</h2>
            <div className="mt-2 inline-block px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold">
              ⚠ APPROVED — AWAITING COLLECTION
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500 font-medium">Receipt ID:</span>
              <span className="font-bold font-mono text-indigo-700">{request.receipt_code}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500 font-medium">Request ID:</span>
              <span className="font-mono font-semibold text-slate-700">{request.request_code}</span>
            </div>
            <div className="border-t border-slate-100 pt-2 mt-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Staff:</span>
                <span className="font-bold text-slate-900">{request.staff_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Staff Branch:</span>
                <span className="font-semibold text-slate-700">{request.requesting_branch_name || request.requesting_branch}</span>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2 mt-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Product:</span>
                <span className="font-bold text-slate-900">{request.product_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Quantity:</span>
                <span className="font-bold text-slate-900">{parseFloat(request.requested_quantity)} {request.unit_type}(s)</span>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2 mt-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Source Branch:</span>
                <span className="font-bold text-indigo-700">{request.source_branch_name || request.source_branch}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Approved By:</span>
                <span className="font-semibold text-slate-700">{request.approved_by_name || request.approved_by_name_display || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Approved Date:</span>
                <span className="font-semibold text-slate-700">{request.approved_at ? new Date(request.approved_at).toLocaleString('en-GB') : '—'}</span>
              </div>
            </div>
            <div className="border-t-2 border-dashed border-slate-300 pt-3 mt-3 text-center">
              <div className="text-[10px] text-slate-500 font-medium">
                This receipt authorizes the bearer to collect goods from the Source Branch above.<br />
                Present this receipt to the branch staff for goods release.<br />
                <strong className="text-amber-700">NOT VALID AFTER GOODS HAVE BEEN RELEASED.</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2 print:hidden">
          <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer">
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
          <button onClick={onClose} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Final Collection Receipt Print View ──────────────────────────────────────
function CollectionReceiptPrint({ request, onClose }) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 z-10 print:hidden">
          <X className="w-5 h-5" />
        </button>

        <div id="collection-receipt-print" className="p-6">
          <div className="text-center border-b border-slate-200 pb-4 mb-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">MURG TEXTILE ENTERPRISES</div>
            <h2 className="text-base font-bold text-slate-900">GOODS COLLECTION CERTIFICATE</h2>
            <div className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold">
              ✓ RELEASED / COLLECTED
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500 font-medium">Collection Receipt:</span>
              <span className="font-bold font-mono text-emerald-700">{request.collection_code}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500 font-medium">Approval Receipt:</span>
              <span className="font-mono text-slate-600">{request.receipt_code}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500 font-medium">Request ID:</span>
              <span className="font-mono text-slate-600">{request.request_code}</span>
            </div>

            <div className="border-t border-slate-100 pt-2 mt-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Staff:</span>
                <span className="font-bold text-slate-900">{request.staff_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Staff Branch:</span>
                <span className="font-semibold text-slate-700">{request.requesting_branch_name || request.requesting_branch}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2 mt-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Product:</span>
                <span className="font-bold text-slate-900">{request.product_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Quantity:</span>
                <span className="font-bold text-slate-900">{parseFloat(request.requested_quantity)} {request.unit_type}(s)</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2 mt-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Source Branch:</span>
                <span className="font-semibold text-slate-700">{request.source_branch_name || request.source_branch}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Destination Branch:</span>
                <span className="font-semibold text-slate-700">{request.requesting_branch_name || request.requesting_branch}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2 mt-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Approved By:</span>
                <span className="font-semibold text-slate-700">{request.approved_by_name || request.approved_by_name_display || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Approval Date:</span>
                <span className="font-semibold text-slate-700">{request.approved_at ? new Date(request.approved_at).toLocaleString('en-GB') : '—'}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2 mt-2 bg-emerald-50 rounded-lg p-2">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Released By:</span>
                <span className="font-bold text-emerald-800">{request.released_by_name || request.released_by_name_display || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-slate-500 font-medium">Release Date:</span>
                <span className="font-bold text-emerald-800">{request.released_at ? new Date(request.released_at).toLocaleString('en-GB') : '—'}</span>
              </div>
            </div>

            <div className="border-t-2 border-dashed border-slate-300 pt-3 mt-3 text-center">
              <div className="text-[10px] text-slate-500">
                This certificate is permanent proof that the goods listed above were physically<br />
                released to the staff member at the source branch.<br />
                <strong className="text-emerald-700">GOODS RELEASED — NOT FOR REUSE.</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2 print:hidden">
          <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer">
            <Printer className="w-4 h-4" /> Print Collection Receipt
          </button>
          <button onClick={onClose} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GoodsRequestsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'pending-release'

  // Pending release (source branch staff)
  const [pendingReleaseRequests, setPendingReleaseRequests] = useState([]);
  const [pendingReleaseLoading, setPendingReleaseLoading] = useState(false);

  // Modal 1: Create Request
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [productMode, setProductMode] = useState('catalog');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customProductName, setCustomProductName] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [reason, setReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Modal 2: Admin Review/Approve
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [eligibleBranches, setEligibleBranches] = useState([]);
  const [selectedSourceStock, setSelectedSourceStock] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Modal 3: Release Receipt (branch staff)
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [receiptCodeInput, setReceiptCodeInput] = useState('');
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [lookingUpReceipt, setLookingUpReceipt] = useState(false);
  const [releasingGoods, setReleasingGoods] = useState(false);
  const [releaseError, setReleaseError] = useState(null);
  const [releaseSuccess, setReleaseSuccess] = useState(null);

  // Modal 4: View/Print approval receipt
  const [approvalReceiptRequest, setApprovalReceiptRequest] = useState(null);

  // Modal 5: View/Print collection receipt
  const [collectionReceiptRequest, setCollectionReceiptRequest] = useState(null);

  // ── Data Fetching ────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      let url = isAdmin ? '/goods-requests' : '/goods-requests/my';
      if (statusFilter && isAdmin) url += `?status=${statusFilter}`;
      const res = await api.get(url);
      setRequests(res.data.data || []);
    } catch (err) {
      setFetchError('Unable to load goods requests.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, statusFilter]);

  const fetchPendingRelease = useCallback(async () => {
    setPendingReleaseLoading(true);
    try {
      const res = await api.get('/goods-requests/pending-release');
      setPendingReleaseRequests(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch pending releases:', err);
    } finally {
      setPendingReleaseLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (activeTab === 'pending-release') {
      fetchPendingRelease();
    }
  }, [activeTab, fetchPendingRelease]);

  // ── Create Request ────────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setProductMode('catalog');
    setSelectedProduct(null);
    setCustomProductName('');
    setRequestedQty('');
    setReason('');
    setCreateModalOpen(true);
  };

  const handleManualEntry = (prefill = '') => {
    setProductMode('custom');
    setSelectedProduct(null);
    setCustomProductName(prefill);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (productMode === 'catalog' && !selectedProduct) {
      alert('Please select a product from the catalog or switch to custom entry.');
      return;
    }
    if (productMode === 'custom' && !customProductName.trim()) {
      alert('Please enter a product name.');
      return;
    }
    if (!requestedQty) {
      alert('Please enter a quantity.');
      return;
    }

    setSubmittingRequest(true);
    try {
      const payload =
        productMode === 'catalog'
          ? { stockId: selectedProduct.id, productName: selectedProduct.name, productSource: 'CATALOG', requestedQuantity: parseFloat(requestedQty), unitType: selectedProduct.unit_type || 'belt', reason }
          : { stockId: null, productName: customProductName.trim(), productSource: 'CUSTOM', requestedQuantity: parseFloat(requestedQty), unitType: 'belt', reason };

      await api.post('/goods-requests', payload);
      setCreateModalOpen(false);
      fetchRequests();
      alert('Goods request submitted successfully! The Admin has been notified.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // ── Admin Review & Approve ────────────────────────────────────────────────────
  const handleOpenReview = async (reqItem) => {
    setActiveRequest(reqItem);
    setSelectedSourceStock('');
    setAdminNotes('');
    setReviewError('');
    setReviewModalOpen(true);
    setReviewActionLoading(true);

    try {
      const res = await api.get(`/goods-requests/${reqItem.id}/eligible-branches`);
      setEligibleBranches(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch eligible branches:', err);
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!activeRequest) return;
    if (!window.confirm('Are you sure you want to reject this goods request?')) return;

    setReviewActionLoading(true);
    setReviewError('');
    try {
      await api.post(`/goods-requests/${activeRequest.id}/reject`, { adminNotes });
      setReviewModalOpen(false);
      fetchRequests();
      alert('Goods request rejected. Staff has been notified.');
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to reject request.');
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleApproveRequest = async () => {
    if (!activeRequest || !selectedSourceStock) {
      setReviewError('Please select an eligible source branch.');
      return;
    }

    const branchObj = eligibleBranches.find((b) => String(b.stockId) === String(selectedSourceStock));
    if (!branchObj) return;

    setReviewActionLoading(true);
    setReviewError('');
    try {
      const res = await api.post(`/goods-requests/${activeRequest.id}/approve`, {
        sourceBranch: branchObj.facilityID,
        sourceStockId: branchObj.stockId,
        adminNotes,
      });

      setReviewModalOpen(false);
      fetchRequests();
      const result = res.data.data;
      alert(
        `✅ Request APPROVED!\n\nApproval Receipt: ${result.receiptCode}\nSource Branch: ${result.sourceBranchName || result.sourceBranch}\n\nStaff has been notified and can now print their receipt to collect goods.`
      );
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to approve request.');
    } finally {
      setReviewActionLoading(false);
    }
  };

  // ── Receipt Release Interface ─────────────────────────────────────────────────
  const openReleaseModal = (prefillCode = '') => {
    setReceiptCodeInput(prefillCode);
    setReceiptPreview(null);
    setReleaseError(null);
    setReleaseSuccess(null);
    setReleaseModalOpen(true);
    if (prefillCode) {
      // Auto-lookup if code provided
      setTimeout(() => handleReceiptLookup(null, prefillCode), 100);
    }
  };

  const handleReceiptLookup = async (e, code = null) => {
    if (e) e.preventDefault();
    const lookupCode = code || receiptCodeInput.trim();
    if (!lookupCode) return;

    setLookingUpReceipt(true);
    setReleaseError(null);
    setReceiptPreview(null);
    setReleaseSuccess(null);

    try {
      const res = await api.get(`/goods-requests/receipt/${lookupCode}`);
      setReceiptPreview(res.data.data);
    } catch (err) {
      setReleaseError(err.response?.data?.message || 'Receipt not found or not valid for your branch.');
    } finally {
      setLookingUpReceipt(false);
    }
  };

  const handleReleaseGoods = async () => {
    if (!receiptCodeInput.trim()) return;
    if (!window.confirm('Confirm goods release? This action will deduct stock and cannot be undone.')) return;

    setReleasingGoods(true);
    setReleaseError(null);

    try {
      const res = await api.post(`/goods-requests/receipt/${receiptCodeInput.trim()}/release`);
      const result = res.data.data;
      setReleaseSuccess(
        `✅ Goods Released Successfully!\n\nCollection Receipt: ${result.collectionCode}\nProduct: ${result.productName}\nQuantity: ${result.quantity} ${result.unitType}(s)\n\nStaff has been notified.`
      );
      setReceiptPreview(null);
      fetchRequests();
      fetchPendingRelease();
    } catch (err) {
      setReleaseError(err.response?.data?.message || 'Failed to release goods.');
    } finally {
      setReleasingGoods(false);
    }
  };

  // ── Render Helpers ────────────────────────────────────────────────────────────
  const renderActionButton = (r) => {
    if (isAdmin && r.status === 'PENDING') {
      return (
        <button onClick={() => handleOpenReview(r)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[11px] cursor-pointer transition-colors">
          Review
        </button>
      );
    }
    if (r.status === 'APPROVED') {
      const isSourceBranch = !isAdmin && r.source_branch === user?.facilityID;
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {/* Staff can view/print their approval receipt */}
          {(!isAdmin && r.staff_id === user?.id || isAdmin) && r.receipt_code && (
            <button onClick={() => setApprovalReceiptRequest(r)} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold rounded text-[10px] hover:bg-indigo-100 cursor-pointer whitespace-nowrap">
              View Receipt
            </button>
          )}
          {/* Source branch staff can release */}
          {isSourceBranch && (
            <button onClick={() => openReleaseModal(r.receipt_code)} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[10px] hover:bg-emerald-100 cursor-pointer whitespace-nowrap">
              Release
            </button>
          )}
        </div>
      );
    }
    if (r.status === 'RELEASED') {
      return (
        <button onClick={() => setCollectionReceiptRequest(r)} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded text-[10px] hover:bg-emerald-100 cursor-pointer whitespace-nowrap">
          Collection Receipt
        </button>
      );
    }
    return <span className="text-[11px] text-slate-400 font-medium">{r.status}</span>;
  };

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 m-0">Staff Goods Requests</h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
              {isAdmin ? 'Admin Management' : `Branch: ${user?.facilityID}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Request goods from feeder branches, track approvals, and collect receipts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isAdmin && (
            <button onClick={openCreateModal} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3.5 rounded-lg shadow-xs cursor-pointer transition-colors">
              <Plus className="w-4 h-4" /> Request Goods
            </button>
          )}
          <button
            onClick={() => openReleaseModal('')}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2 px-3.5 rounded-lg shadow-xs cursor-pointer transition-colors"
          >
            <QrCode className="w-4 h-4" /> Enter Receipt Code
          </button>
        </div>
      </div>

      {/* ── Tabs (for source branch) ────────────────────────────────────────── */}
      {!isAdmin && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === 'requests' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            My Requests
          </button>
          <button
            onClick={() => setActiveTab('pending-release')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'pending-release' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <BadgeCheck className="w-3.5 h-3.5" /> Pending Release at My Branch
            {pendingReleaseRequests.length > 0 && (
              <span className="px-1.5 py-0.5 bg-emerald-500 text-white rounded-full text-[10px] font-bold">{pendingReleaseRequests.length}</span>
            )}
          </button>
        </div>
      )}

      {/* ── Admin Filter Bar ─────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING — Awaiting Admin Review</option>
              <option value="APPROVED">APPROVED — Awaiting Collection</option>
              <option value="RELEASED">RELEASED — Completed</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <button onClick={fetchRequests} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* ── Pending Release Tab (source branch staff) ────────────────────────── */}
      {activeTab === 'pending-release' && !isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pending Release — Your Branch ({user?.facilityID})</h2>
              <p className="text-xs text-slate-500 mt-0.5">These APPROVED requests are designated for release from your branch.</p>
            </div>
            <button onClick={fetchPendingRelease} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
              <RefreshCw className={`w-4 h-4 text-slate-500 ${pendingReleaseLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {pendingReleaseLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading...</div>
          ) : pendingReleaseRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <BadgeCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              No approved requests pending release at your branch.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingReleaseRequests.map((r) => (
                <div key={r.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-indigo-700 text-xs">{r.receipt_code}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs font-bold text-slate-900">{r.product_name} — {parseFloat(r.requested_quantity)} {r.unit_type}(s)</p>
                      <p className="text-xs text-slate-500">
                        Requested by: <strong>{r.staff_name}</strong> from <strong>{r.requesting_branch_name || r.requesting_branch}</strong>
                      </p>
                      <p className="text-xs text-slate-400">Approved: {r.approved_at ? new Date(r.approved_at).toLocaleString('en-GB') : '—'} by {r.approved_by_name_display || '—'}</p>
                    </div>
                    <div className="shrink-0">
                      <button
                        onClick={() => openReleaseModal(r.receipt_code)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Release Goods
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main Requests Table ──────────────────────────────────────────────── */}
      {(activeTab === 'requests' || isAdmin) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden min-w-0">
          {fetchError && (
            <div className="p-4 bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {fetchError}
            </div>
          )}

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Request</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Staff</th>
                  <th className="py-3 px-4 hidden md:table-cell">Product</th>
                  <th className="py-3 px-4 hidden md:table-cell">Qty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Source Branch</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Date</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr><td colSpan="8" className="py-8 text-center text-slate-400">Loading requests...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan="8" className="py-8 text-center text-slate-400">No goods requests found.</td></tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 text-[11px] whitespace-nowrap">{r.request_code}</div>
                        {r.receipt_code && <div className="font-mono text-[10px] text-indigo-600 mt-0.5">{r.receipt_code}</div>}
                        {r.collection_code && <div className="font-mono text-[10px] text-emerald-600 mt-0.5">{r.collection_code}</div>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 hidden sm:table-cell">{r.staff_name}</td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{r.product_name}</span>
                          {r.product_source && <ProductSourceBadge source={r.product_source} />}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap hidden md:table-cell">
                        {parseFloat(r.requested_quantity)} {r.unit_type}(s)
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                      <td className="py-3 px-4 font-mono text-slate-600 hidden lg:table-cell">{r.source_branch_name || r.source_branch || '—'}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap hidden lg:table-cell">{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="py-3 px-4 text-center">{renderActionButton(r)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Modal 1: Create Goods Request ══════════════════════════════════════ */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setCreateModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-1">Submit Goods Request</h3>
            <p className="text-xs text-slate-500 mb-4">Request inventory from feeder branches. Admin will review and approve.</p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                <button type="button" onClick={() => { setProductMode('catalog'); setCustomProductName(''); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${productMode === 'catalog' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <BookOpen className="w-3.5 h-3.5" /> From Catalog
                </button>
                <button type="button" onClick={() => { setProductMode('custom'); setSelectedProduct(null); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${productMode === 'custom' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <PenLine className="w-3.5 h-3.5" /> Custom Entry
                </button>
              </div>

              {productMode === 'catalog' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Search &amp; Select Catalog Product *</label>
                  <CatalogSearchCombobox onSelect={(p) => setSelectedProduct(p)} onManualEntry={handleManualEntry} />
                  {selectedProduct && (
                    <div className="mt-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-bold text-indigo-800 text-xs">{selectedProduct.name}</span>
                      <span className="text-[10px] text-indigo-500 font-mono">{selectedProduct.unit_type}</span>
                    </div>
                  )}
                </div>
              )}

              {productMode === 'custom' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input type="text" placeholder="Enter product name..." value={customProductName} onChange={(e) => setCustomProductName(e.target.value)} maxLength={200} required className="w-full bg-slate-50 border border-amber-300 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requested Quantity *</label>
                <input type="number" step="0.01" min="0.1" required placeholder="e.g. 5" value={requestedQty} onChange={(e) => setRequestedQty(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-semibold" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <textarea rows="2" placeholder="e.g. Low stock at branch store..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs" />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="submit" disabled={submittingRequest} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer disabled:opacity-60">
                  {submittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Modal 2: Admin Review & Approve ════════════════════════════════════ */}
      {reviewModalOpen && activeRequest && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setReviewModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900 m-0">Review Goods Request</h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Ref: <code className="font-mono text-indigo-600 font-bold">{activeRequest.request_code}</code>
              </p>
            </div>

            {reviewError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {reviewError}
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Requesting Staff:</span><span className="font-bold text-slate-900">{activeRequest.staff_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Destination Branch:</span><span className="font-bold text-indigo-700">{activeRequest.requesting_branch_name || activeRequest.requesting_branch}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Requested Product:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">{activeRequest.product_name}</span>
                  {activeRequest.product_source && <ProductSourceBadge source={activeRequest.product_source} />}
                </div>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Requested Quantity:</span><span className="font-bold text-slate-900">{parseFloat(activeRequest.requested_quantity)} {activeRequest.unit_type}(s)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Requested:</span><span className="text-slate-600">{new Date(activeRequest.created_at).toLocaleString('en-GB')}</span></div>
              {activeRequest.reason && (
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Reason:</span>
                  <span className="text-slate-700 italic text-right max-w-[55%]">{activeRequest.reason}</span>
                </div>
              )}
            </div>

            {activeRequest.product_source === 'CUSTOM' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <PenLine className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Custom Product Request</strong>
                  <p className="mt-0.5 font-normal">This product was entered manually by staff. Verify the product name matches your stock records.</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Select Source Branch with Sufficient Stock *</label>
              {reviewActionLoading && eligibleBranches.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Checking stock availability across all branches...</span>
                </div>
              ) : eligibleBranches.length === 0 ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No branches currently have sufficient stock for this request.</span>
                </div>
              ) : (
                <select value={selectedSourceStock} onChange={(e) => setSelectedSourceStock(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900">
                  <option value="">-- Choose Source Branch --</option>
                  {eligibleBranches.map((b) => (
                    <option key={b.stockId} value={b.stockId}>{b.branchName} ({b.facilityID}) — Available: {b.availableQuantity} {b.unitType}(s)</option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-slate-400 mt-1">The staff member will be directed to collect goods from this branch using their approval receipt.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Notes</label>
              <input type="text" placeholder="Optional notes..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs" />
            </div>

            <div className="pt-2 flex gap-2 flex-wrap">
              <button type="button" onClick={handleApproveRequest} disabled={reviewActionLoading || !selectedSourceStock} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs disabled:opacity-50 cursor-pointer min-w-[140px]">
                {reviewActionLoading ? 'Processing...' : '✓ Approve Request'}
              </button>
              <button type="button" onClick={handleRejectRequest} disabled={reviewActionLoading} className="px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs cursor-pointer">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal 3: Release Goods (Branch Staff) ══════════════════════════════ */}
      {releaseModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button onClick={() => setReleaseModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-bold text-slate-900 m-0">Validate &amp; Release Goods</h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Enter the approval receipt code from the staff member.
              </p>
            </div>

            {releaseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> <span>{releaseError}</span>
              </div>
            )}

            {releaseSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs whitespace-pre-wrap">
                {releaseSuccess}
              </div>
            )}

            {!releaseSuccess && (
              <form onSubmit={handleReceiptLookup} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Approval Receipt Code *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. RCP-20260924-12345"
                      value={receiptCodeInput}
                      onChange={(e) => setReceiptCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono font-bold uppercase tracking-wider"
                    />
                    <button type="submit" disabled={lookingUpReceipt || !receiptCodeInput.trim()} className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-60 whitespace-nowrap">
                      {lookingUpReceipt ? 'Checking...' : 'Lookup'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {receiptPreview && !releaseSuccess && (
              <div className="space-y-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-700 text-sm">Receipt Valid — Ready to Release</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <span className="text-slate-500">Staff:</span><span className="font-bold text-slate-900">{receiptPreview.staff_name}</span>
                    <span className="text-slate-500">From Branch:</span><span className="font-semibold">{receiptPreview.requesting_branch_name || receiptPreview.requesting_branch}</span>
                    <span className="text-slate-500">Product:</span><span className="font-bold text-slate-900">{receiptPreview.product_name}</span>
                    <span className="text-slate-500">Quantity:</span><span className="font-bold text-slate-900">{parseFloat(receiptPreview.requested_quantity)} {receiptPreview.unit_type}(s)</span>
                    <span className="text-slate-500">Approved By:</span><span className="font-semibold">{receiptPreview.approved_by_name_display || '—'}</span>
                    <span className="text-slate-500">Approved:</span><span className="font-semibold">{receiptPreview.approved_at ? new Date(receiptPreview.approved_at).toLocaleString('en-GB') : '—'}</span>
                  </div>
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[10px]">
                    ⚠ Releasing goods will deduct <strong>{parseFloat(receiptPreview.requested_quantity)} {receiptPreview.unit_type}(s)</strong> of <strong>{receiptPreview.product_name}</strong> from your branch inventory. This cannot be undone.
                  </div>
                </div>

                <button type="button" onClick={handleReleaseGoods} disabled={releasingGoods} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-xs cursor-pointer transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {releasingGoods ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Releasing...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Confirm Release Goods</>
                  )}
                </button>
              </div>
            )}

            {releaseSuccess && (
              <button onClick={() => setReleaseModalOpen(false)} className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer">
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ Modal 4: Approval Receipt Print ════════════════════════════════════ */}
      {approvalReceiptRequest && (
        <ApprovalReceiptPrint
          request={approvalReceiptRequest}
          onClose={() => setApprovalReceiptRequest(null)}
        />
      )}

      {/* ══ Modal 5: Collection Receipt Print ══════════════════════════════════ */}
      {collectionReceiptRequest && (
        <CollectionReceiptPrint
          request={collectionReceiptRequest}
          onClose={() => setCollectionReceiptRequest(null)}
        />
      )}
    </div>
  );
}
