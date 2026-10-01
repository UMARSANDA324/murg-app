import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import { formatDate } from '../utils/dateUtils';
import {
  Users,
  Plus,
  CreditCard,
  Search,
  History,
  Phone,
  Building,
  CheckCircle2,
  X,
  Banknote,
  Printer,
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

export default function CustomersPage() {
  const { activeBranch } = useBranchStore();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [loading, setLoading] = useState(false);

  // New Customer Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState('Male');
  const [newAddress, setNewAddress] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  // Deposit Modal
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositSaving, setDepositSaving] = useState(false);

  // History Modal (deposits + debt/credit items)
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [debtHistoryList, setDebtHistoryList] = useState([]);
  const [historyTab, setHistoryTab] = useState('deposits'); // 'deposits' | 'debt'
  const [historyLoading, setHistoryLoading] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState(null);

  useEffect(() => {
    if (activeBranch) {
      fetchCustomers();
    }
  }, [activeBranch, debouncedSearch]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let url = `/customers?branchId=${activeBranch}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      const res = await api.get(url);
      setCustomers(res.data.data || []);
    } catch (err) {
      console.error('[Customers] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setCreateSaving(true);
    try {
      await api.post(`/customers?branchId=${activeBranch}`, {
        name: newName,
        phone: newPhone,
        email: newEmail,
        gender: newGender,
        address: newAddress,
      });

      setCreateModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      fetchCustomers();
      alert('Customer registered successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register customer.');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleOpenDeposit = (customer) => {
    setSelectedCustomer(customer);
    setDepositAmount('');
    setPaymentMethod('Cash');
    setDepositDesc('');
    setDepositModalOpen(true);
  };

  const handleRecordDeposit = async (e) => {
    e.preventDefault();
    setDepositSaving(true);
    try {
      await api.post(`/customers/${selectedCustomer.id}/deposits?branchId=${activeBranch}`, {
        amount: parseFloat(depositAmount),
        paymentMethod,
        description: depositDesc,
      });

      setDepositModalOpen(false);
      fetchCustomers();
      alert('Debt repayment deposit recorded and balance updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record deposit.');
    } finally {
      setDepositSaving(false);
    }
  };

  const handleViewHistory = async (customer) => {
    setSelectedCustomer(customer);
    setHistoryTab('deposits');
    setHistoryList([]);
    setDebtHistoryList([]);
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    try {
      const [depRes, debtRes] = await Promise.all([
        api.get(`/customers/${customer.id}/deposits?branchId=${activeBranch}`),
        api.get(`/customers/${customer.id}/debt-history?branchId=${activeBranch}`),
      ]);
      setHistoryList(depRes.data.data || []);
      setDebtHistoryList(debtRes.data.data || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load customer history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0">Customer & Dealer Ledgers</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage wholesale buyers, track credit debt balances, and record debt payments
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Customer List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4">Contact Phone</th>
              <th className="py-3 px-4">Location</th>
              <th className="py-3 px-4 text-right">Outstanding Debt</th>
              <th className="py-3 px-4 text-right">Total Deposited</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900">{c.name}</div>
                  <span className="text-[10px] text-slate-400">{c.gender}</span>
                </td>
                <td className="py-3 px-4 text-slate-600 font-mono">{c.phone || 'N/A'}</td>
                <td className="py-3 px-4 text-slate-500 truncate max-w-xs">{c.address || 'Kano'}</td>
                <td className="py-3 px-4 text-right font-black">
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${
                      c.outstanding_balance > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ₦{c.outstanding_balance.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                  ₦{c.total_deposited.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => handleOpenDeposit(c)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] py-1 px-2.5 rounded cursor-pointer"
                    >
                      Record Deposit
                    </button>
                    <button
                      onClick={() => handleViewHistory(c)}
                      className="text-slate-500 hover:text-slate-800 text-[11px] font-medium underline px-1"
                    >
                      History
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan="6" className="py-8 text-center text-slate-400">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Deposit Modal */}
      {depositModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setDepositModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">Record Debt Payment Deposit</h3>
            <p className="text-xs text-slate-500 mb-3">
              Customer: <strong>{selectedCustomer.name}</strong> • Current Debt: ₦
              {selectedCustomer.outstanding_balance.toLocaleString()}
            </p>

            <form onSubmit={handleRecordDeposit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deposit Amount (₦) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="POS">POS Card</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt / Transaction Note</label>
                <input
                  type="text"
                  placeholder="Deposit reference or remarks"
                  value={depositDesc}
                  onChange={(e) => setDepositDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={depositSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs"
                >
                  {depositSaving ? 'Recording Deposit...' : 'Confirm Deposit'}
                </button>
                <button
                  type="button"
                  onClick={() => setDepositModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal — Deposits & Credit Items */}
      {historyModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div id="customer-history-print" className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setHistoryModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Customer History: {selectedCustomer.name}
                </h3>
                <p className="text-xs text-slate-500 m-0">
                  Full ledger — deposits made and credit items collected · Branch: {activeBranch}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="print:hidden inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
                title="Print this ledger"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Ledger</span>
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-slate-200 mb-4 shrink-0">
              <button
                onClick={() => setHistoryTab('deposits')}
                className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors ${
                  historyTab === 'deposits'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Deposit Payments ({historyList.length})
              </button>
              <button
                onClick={() => setHistoryTab('debt')}
                className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors ${
                  historyTab === 'debt'
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Credit Items Collected ({debtHistoryList.length})
              </button>
            </div>

            {/* Loading state */}
            {historyLoading && (
              <div className="flex-1 flex items-center justify-center py-10 text-slate-400 text-xs">
                Loading history…
              </div>
            )}

            {/* Deposits Tab */}
            {!historyLoading && historyTab === 'deposits' && (
              <div className="overflow-auto flex-1 space-y-2">
                {historyList.map((d) => (
                  <div key={d.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 block">{d.transaction_id}</span>
                      <span className="font-bold text-slate-800">{d.payment_method}</span>
                      <span className="text-slate-500 text-[11px] block">
                        {d.deposit_date ? new Date(d.deposit_date).toLocaleString() : 'Date unavailable'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-700 block">
                        +₦{parseFloat(d.amount).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Balance:{' '}
                        {d.new_balance != null && !isNaN(parseFloat(d.new_balance))
                          ? '₦' + parseFloat(d.new_balance).toLocaleString()
                          : 'N/A'}
                      </span>
                      <button
                        onClick={() => setPrintReceiptData({ ...d, customerName: selectedCustomer.name })}
                        className="mt-1 text-[10px] text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        Print Receipt
                      </button>
                    </div>
                  </div>
                ))}
                {historyList.length === 0 && (
                  <p className="text-center py-6 text-slate-400 text-xs">No deposit transactions on record.</p>
                )}
              </div>
            )}

            {/* Debt / Credit Items Tab */}
            {!historyLoading && historyTab === 'debt' && (
              <div className="overflow-auto flex-1">
                {debtHistoryList.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-xs">No credit order history on record.</p>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3 text-left">Date</th>
                        <th className="py-2 px-3 text-left">Item / Product</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Amount (₦)</th>
                        <th className="py-2 px-3 text-left">Order Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {debtHistoryList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                            {item.date ? formatDate(item.date) : 'Date unavailable'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {item.item || 'Historical item details unavailable'}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600">
                            {item.quantity != null ? item.quantity : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-amber-800">
                            {item.net_total != null
                              ? '₦' + parseFloat(item.net_total).toLocaleString()
                              : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-[10px] text-slate-400">
                            {item.order_id || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}



      {/* Deposit Receipt Print View */}
      {printReceiptData && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative">
            <button onClick={() => setPrintReceiptData(null)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 z-10 print:hidden">
              <X className="w-5 h-5" />
            </button>

            <div id="deposit-receipt-print" className="p-6">
              <div className="text-center border-b border-slate-200 pb-4 mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">MURG TEXTile Enterprises</div>
                <h2 className="text-base font-bold text-slate-900">DEBT PAYMENT RECEIPT</h2>
                <div className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold">
                  ✓ PAYMENT RECORDED
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-slate-500 font-medium">Receipt No:</span>
                  <span className="font-bold font-mono text-indigo-700">{printReceiptData.transaction_id || printReceiptData.receipt_number || '—'}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="font-bold text-slate-900">{printReceiptData.customerName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Branch:</span>
                    <span className="font-semibold text-slate-700">{activeBranch}</span>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Payment Date:</span>
                    <span className="font-semibold text-slate-700">{printReceiptData.deposit_date ? formatDate(printReceiptData.deposit_date) : 'Date unavailable'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Payment Method:</span>
                    <span className="font-semibold text-slate-700">{printReceiptData.payment_method}</span>
                  </div>
                </div>
                <div className="border-t-2 border-slate-200 pt-3 mt-3 bg-emerald-50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Amount Paid:</span>
                    <span className="font-bold text-emerald-800 text-lg">₦{parseFloat(printReceiptData.amount).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">New Balance:</span>
                    <span className="font-semibold text-slate-700">
                      {printReceiptData.new_balance != null && !isNaN(parseFloat(printReceiptData.new_balance))
                        ? '₦' + parseFloat(printReceiptData.new_balance).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="border-t-2 border-dashed border-slate-300 pt-3 mt-3 text-center">
                  <div className="text-[10px] text-slate-500">
                    This receipt confirms that the debt payment above was recorded at the branch.<br />
                    <strong className="text-emerald-700">PAYMENT VERIFIED — OFFICIAL RECORD.</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => setPrintReceiptData(null)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">Register New Customer</h3>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer / Dealer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alhaji Sani Garba"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 08012345678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="customer@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shop / Market Address</label>
                <input
                  type="text"
                  placeholder="e.g. Shop 4B Kwari Market"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={createSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs"
                >
                  {createSaving ? 'Registering...' : 'Register Customer'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
