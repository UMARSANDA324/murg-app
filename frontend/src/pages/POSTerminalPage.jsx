import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import {
  Search,
  ShoppingCart,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Building,
  User,
  X,
} from 'lucide-react';

export default function POSTerminalPage() {
  const { activeBranch, activeBranchData } = useBranchStore();
  const isPerYard = activeBranchData?.sales_mode === 'PER_YARD';

  const [stocks, setStocks] = useState([]);
  const [stores, setStores] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [buyerName, setBuyerName] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [isCredit, setIsCredit] = useState(false);

  // Split payment state
  const [cashAmount, setCashAmount] = useState('');
  const [posAmount, setPosAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [bankName, setBankName] = useState('');

  // Receipt modal state
  const [receiptData, setReceiptData] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (activeBranch) {
      fetchStores();
      fetchStocks();
      fetchCustomers();
    }
  }, [activeBranch, selectedStore]);

  const fetchStores = async () => {
    try {
      const res = await api.get(`/stocks/stores?branchId=${activeBranch}`);
      const list = res.data.data || [];
      setStores(list);
      if (list.length > 0 && !selectedStore) {
        setSelectedStore(list[0].id);
      }
    } catch (err) {
      console.error('[POS] Error fetching stores:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get(`/customers?branchId=${activeBranch}`);
      setCustomers(res.data.data || []);
    } catch (err) {
      console.error('[POS] Error fetching customers:', err);
    }
  };

  const fetchStocks = async () => {
    try {
      let url = `/stocks?branchId=${activeBranch}`;
      if (selectedStore) url += `&storeId=${selectedStore}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(url);
      setStocks(res.data.data || []);
    } catch (err) {
      console.error('[POS] Error fetching stocks:', err);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find((item) => item.stockId === product.id);
    const unitPrice = (isPerYard || product.unit_type === 'yard') && product.price_per_yard
      ? parseFloat(product.price_per_yard)
      : parseFloat(product.selling);
    const unitType = product.unit_type || (isPerYard ? 'yard' : 'belt');

    if (existing) {
      const step = isPerYard ? 1 : 1;
      if (existing.quantity + step > product.quantity) {
        alert(`Cannot add more. Only ${product.quantity} available.`);
        return;
      }
      setCart(cart.map((item) => (item.stockId === product.id ? { ...item, quantity: item.quantity + step } : item)));
    } else {
      if (product.quantity <= 0) {
        alert('Product is out of stock.');
        return;
      }
      setCart([
        ...cart,
        {
          stockId: product.id,
          name: product.name,
          price: unitPrice,
          available: product.quantity,
          unitType: unitType,
          itemDiscount: 0,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (stockId, delta) => {
    setCart(
      cart
        .map((item) => {
          if (item.stockId === stockId) {
            const newQty = parseFloat((item.quantity + delta).toFixed(2));
            if (newQty <= 0) return null;
            if (newQty > item.available) {
              alert(`Exceeds available stock (${item.available}).`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const setDirectQuantity = (stockId, val) => {
    const qty = parseFloat(val);
    if (isNaN(qty) || qty <= 0) return;
    setCart(
      cart.map((item) => {
        if (item.stockId === stockId) {
          if (qty > item.available) {
            alert(`Exceeds available stock (${item.available}).`);
            return { ...item, quantity: item.available };
          }
          return { ...item, quantity: qty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (stockId) => {
    setCart(cart.filter((item) => item.stockId !== stockId));
  };

  // Totals calculation
  const grossTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalItemDiscounts = cart.reduce((acc, item) => acc + (parseFloat(item.itemDiscount) || 0) * item.quantity, 0);
  const netTotal = Math.max(0, grossTotal - totalItemDiscounts - (parseFloat(globalDiscount) || 0));

  const totalPaid = (parseFloat(cashAmount) || 0) + (parseFloat(posAmount) || 0) + (parseFloat(transferAmount) || 0);
  const changeDue = Math.max(0, totalPaid - netTotal);
  const creditBalance = isCredit ? Math.max(0, netTotal - totalPaid) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty.');
      return;
    }

    if (!isCredit && totalPaid < netTotal) {
      alert(`Total payment (₦${totalPaid.toLocaleString()}) is less than net payable (₦${netTotal.toLocaleString()}). For credit sales, enable the Credit Sale option.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const selectedCustomer = customers.find(c => c.id === parseInt(selectedCustomerId));
      const payload = {
        branchId: activeBranch,
        buyerName: buyerName || (selectedCustomer ? selectedCustomer.name : 'Retail Customer'),
        customerId: selectedCustomerId ? parseInt(selectedCustomerId) : null,
        customerName: selectedCustomer ? selectedCustomer.name : null,
        items: cart.map((item) => ({
          stockId: item.stockId,
          quantity: item.quantity,
          price: item.price,
          itemDiscount: item.itemDiscount || 0,
        })),
        globalDiscount: parseFloat(globalDiscount) || 0,
        payment: {
          cash: parseFloat(cashAmount) || 0,
          pos: parseFloat(posAmount) || 0,
          transfer: parseFloat(transferAmount) || 0,
          bankName: bankName || null,
        },
        isCredit: Boolean(isCredit),
      };

      const res = await api.post('/sales/checkout', payload);
      const orderID = res.data.data.orderID;

      // Fetch dynamic receipt
      const receiptRes = await api.get(`/sales/${orderID}/receipt?branchId=${activeBranch}`);
      setReceiptData(receiptRes.data.data);
      setReceiptModalOpen(true);

      // Reset cart
      setCart([]);
      setCashAmount('');
      setPosAmount('');
      setTransferAmount('');
      setBankName('');
      setGlobalDiscount(0);
      setBuyerName('');
      setIsCredit(false);
      setSelectedCustomerId('');

      // Refresh stock balance
      fetchStocks();
    } catch (err) {
      const msg = err.response?.data?.message || 'Checkout failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Product Selection & Catalog */}
      <div className="lg:col-span-7 space-y-4">
        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search fabric, shadda, lace by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStocks()}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:w-48">
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

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stocks.map((item) => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                item.quantity > 0
                  ? 'bg-white border-slate-200 hover:border-indigo-500 hover:shadow-md'
                  : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {item.store_name || 'Main Store'}
                </span>
                <h4 className="text-sm font-bold text-slate-900 m-0 line-clamp-1">{item.name}</h4>
                <span className="text-xs text-slate-500 capitalize">{item.unit_type}</span>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-black text-indigo-700">
                  ₦{((isPerYard || item.unit_type === 'yard') && item.price_per_yard ? item.price_per_yard : item.selling).toLocaleString()}
                  <span className="text-[10px] text-slate-500 font-normal">/{item.unit_type === 'yard' || isPerYard ? 'yd' : 'belt'}</span>
                </span>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    item.quantity > 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {item.quantity} {item.unit_type === 'yard' || isPerYard ? 'yds' : 'left'}
                </span>
              </div>
            </div>
          ))}
          {stocks.length === 0 && (
            <div className="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
              No products found in this branch/store.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Active Cart & Checkout */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[calc(100vh-120px)] sticky top-20">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900 m-0">Active POS Cart</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {isPerYard && (
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                PER YARD
              </span>
            )}
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
              {cart.length} items
            </span>
          </div>
        </div>

        {/* Customer Input & Sale Mode Toggle */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Sale Mode:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setIsCredit(false)}
                className={`text-[11px] font-bold py-1 px-2.5 rounded cursor-pointer ${
                  !isCredit ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'
                }`}
              >
                Cash / Direct
              </button>
              <button
                type="button"
                onClick={() => setIsCredit(true)}
                className={`text-[11px] font-bold py-1 px-2.5 rounded cursor-pointer ${
                  isCredit ? 'bg-amber-600 text-white' : 'bg-white border text-slate-600'
                }`}
              >
                Credit Sale
              </button>
            </div>
          </div>

          {isCredit ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-amber-800 uppercase block">Registered Customer (Debt Tracking) *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  const cust = customers.find(c => c.id === parseInt(e.target.value));
                  if (cust) setBuyerName(cust.name);
                }}
                className="w-full bg-white border border-amber-300 rounded-lg py-1.5 px-2 text-xs font-medium focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Choose Debtor / Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Walk-in Buyer Name (Optional)"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-auto p-3 divide-y divide-slate-100">
          {cart.map((item) => (
            <div key={item.stockId} className="py-2.5 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 m-0 truncate">{item.name}</p>
                <p className="text-xs text-slate-500 m-0">₦{item.price.toLocaleString()} /{item.unitType === 'yard' || isPerYard ? 'yd' : 'belt'}</p>
              </div>

              {/* Quantity Controls with Decimal Input */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateQuantity(item.stockId, isPerYard ? -0.5 : -1)}
                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max={item.available}
                  value={item.quantity}
                  onChange={(e) => setDirectQuantity(item.stockId, e.target.value)}
                  className="w-14 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded px-1 py-0.5"
                />
                <button
                  onClick={() => updateQuantity(item.stockId, isPerYard ? 0.5 : 1)}
                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="text-right min-w-[70px]">
                <p className="text-xs font-bold text-slate-900 m-0">
                  ₦{(item.price * item.quantity).toLocaleString()}
                </p>
                <button
                  onClick={() => removeFromCart(item.stockId)}
                  className="text-[11px] text-rose-500 hover:underline mt-0.5 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs">
              <ShoppingCart className="w-8 h-8 mb-2 stroke-1" />
              <span>Cart is empty. Select products on the left.</span>
            </div>
          )}
        </div>

        {/* Financial Summary & Split Payments */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Gross Total:</span>
              <span className="font-semibold">₦{grossTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Global Discount (₦):</span>
              <input
                type="number"
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(e.target.value)}
                className="w-24 bg-white border border-slate-300 rounded px-2 py-0.5 text-right font-medium text-xs"
              />
            </div>
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>Net Payable:</span>
              <span className="text-indigo-600">₦{netTotal.toLocaleString()}</span>
            </div>
            {isCredit && (
              <div className="flex justify-between text-xs font-bold text-amber-700 pt-0.5">
                <span>Credit / Debt Balance:</span>
                <span>₦{creditBalance.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Split Payment Inputs */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Payment Breakdown
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Cash (₦)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">POS Card (₦)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={posAmount}
                  onChange={(e) => setPosAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Transfer (₦)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>
            {parseFloat(transferAmount) > 0 && (
              <input
                type="text"
                placeholder="Bank Name for Transfer (e.g. Jaiz Bank)"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs mt-1"
              />
            )}
            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-500">Total Tendered: ₦{totalPaid.toLocaleString()}</span>
              <span className="font-bold text-emerald-700">Change: ₦{changeDue.toLocaleString()}</span>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-200 m-0">
              {errorMsg}
            </p>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Processing Sale...' : `Complete Sale (₦${netTotal.toLocaleString()})`}</span>
          </button>
        </div>
      </div>

      {/* Printable Thermal Receipt Modal (80mm) */}
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
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Receipt Generated</span>
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
                <p className="m-0">Thank you for your patronage!</p>
                <p className="m-0">No refund after cut. Goods in good condition.</p>
              </div>
            </div>

            {/* Print action buttons */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Receipt (80mm)</span>
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
