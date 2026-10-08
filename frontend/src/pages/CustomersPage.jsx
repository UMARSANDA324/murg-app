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

  // History Modal (deposits + debt/credit items + change history)
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [debtHistoryList, setDebtHistoryList] = useState([]);
  const [creditHistoryList, setCreditHistoryList] = useState([]);
  const [historyTab, setHistoryTab] = useState('deposits'); // 'deposits' | 'debt' | 'credit'
  const [historyLoading, setHistoryLoading] = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState(null);

  // Collect Change Modal
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectPaymentMethod, setCollectPaymentMethod] = useState('Cash');
  const [collectNotes, setCollectNotes] = useState('');
  const [collectSaving, setCollectSaving] = useState(false);
  const [changeReceiptData, setChangeReceiptData] = useState(null);

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
      const res = await api.post(`/customers/${selectedCustomer.id}/deposits?branchId=${activeBranch}`, {
        amount: parseFloat(depositAmount),
        paymentMethod,
        description: depositDesc,
      });

      const receiptInfo = res.data?.data || {
        transaction_id: `DEP-${Date.now()}`,
        customerName: selectedCustomer.name,
        amount: parseFloat(depositAmount),
        previous_balance: selectedCustomer.outstanding_balance,
        new_balance: Math.max(0, (selectedCustomer.outstanding_balance || 0) - parseFloat(depositAmount)),
        payment_method: paymentMethod,
        deposit_date: new Date(),
      };

      setDepositModalOpen(false);
      setPrintReceiptData({
        ...receiptInfo,
        customerName: selectedCustomer.name,
      });
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record deposit.');
    } finally {
      setDepositSaving(false);
    }
  };

  const handleOpenCollectChange = (customer) => {
    setSelectedCustomer(customer);
    setCollectAmount('');
    setCollectPaymentMethod('Cash');
    setCollectNotes('');
    setCollectModalOpen(true);
  };

  const handleCollectChange = async (e) => {
    e.preventDefault();
    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid collection amount.');
      return;
    }
    if (amt > (selectedCustomer.credit_balance || 0)) {
      alert(`Amount exceeds available change credit (₦${(selectedCustomer.credit_balance || 0).toLocaleString()}).`);
      return;
    }

    setCollectSaving(true);
    try {
      const res = await api.post(`/customers/${selectedCustomer.id}/collect-change?branchId=${activeBranch}`, {
        amount: amt,
        paymentMethod: collectPaymentMethod,
        notes: collectNotes,
      });

      const receiptInfo = res.data?.data || {
        receipt_number: `CHG-${Date.now()}`,
        customer_name: selectedCustomer.name,
        amount_collected: amt,
        previous_change: selectedCustomer.credit_balance,
        remaining_change: Math.max(0, (selectedCustomer.credit_balance || 0) - amt),
        payment_method: collectPaymentMethod,
        date: new Date(),
      };

      setCollectModalOpen(false);
      setChangeReceiptData(receiptInfo);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to collect change.');
    } finally {
      setCollectSaving(false);
    }
  };

  const handleViewHistory = async (customer) => {
    setSelectedCustomer(customer);
    setHistoryTab('deposits');
    setHistoryList([]);
    setDebtHistoryList([]);
    setCreditHistoryList([]);
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    try {
      const [depRes, debtRes, creditRes] = await Promise.all([
        api.get(`/customers/${customer.id}/deposits?branchId=${activeBranch}`),
        api.get(`/customers/${customer.id}/debt-history?branchId=${activeBranch}`),
        api.get(`/customers/${customer.id}/credit-history?branchId=${activeBranch}`).catch(() => ({ data: { data: [] } })),
      ]);
      setHistoryList(depRes.data.data || []);
      setDebtHistoryList(debtRes.data.data || []);
      setCreditHistoryList(creditRes.data.data || []);
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
      <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs print:overflow-visible">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4">Contact Phone</th>
              <th className="py-3 px-4">Location</th>
              <th className="py-3 px-4 text-right">Outstanding Debt</th>
              <th className="py-3 px-4 text-right">Available Change</th>
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
                    ₦{(c.outstanding_balance || 0).toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-black">
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${
                      c.credit_balance > 0 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'text-slate-400 font-normal'
                    }`}
                  >
                    {c.credit_balance > 0 ? `₦${c.credit_balance.toLocaleString()}` : '₦0'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-600">
                  ₦{(c.total_deposited || 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {c.credit_balance > 0 && (
                      <button
                        onClick={() => handleOpenCollectChange(c)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-1 px-2.5 rounded cursor-pointer transition-colors"
                        title="Collect change in cash"
                      >
                        Collect Change
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenDeposit(c)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] py-1 px-2.5 rounded cursor-pointer"
                    >
                      Record Deposit
                    </button>
                    <button
                      onClick={() => handleViewHistory(c)}
                      className="text-slate-500 hover:text-slate-800 text-[11px] font-medium underline px-1 cursor-pointer"
                    >
                      History
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-400">
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

      {/* Collect Change Modal */}
      {collectModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setCollectModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900 m-0">Collect Customer Change</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Customer: <strong>{selectedCustomer.name}</strong> • Available Change: <strong className="text-emerald-700 font-mono">₦{(selectedCustomer.credit_balance || 0).toLocaleString()}</strong>
            </p>

            <form onSubmit={handleCollectChange} className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Amount to Collect (₦) *</label>
                  <button
                    type="button"
                    onClick={() => setCollectAmount(String(selectedCustomer.credit_balance || 0))}
                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Collect All (₦{(selectedCustomer.credit_balance || 0).toLocaleString()})
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedCustomer.credit_balance || 0}
                  placeholder="e.g. 50000"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payout Method *</label>
                <select
                  value={collectPaymentMethod}
                  onChange={(e) => setCollectPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="POS">POS / Card</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Customer collected cash in person"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={collectSaving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {collectSaving ? 'Processing Collection...' : 'Confirm Cash Payout'}
                </button>
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Collection Receipt Modal */}
      {changeReceiptData && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setChangeReceiptData(null)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 z-10 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div id="change-receipt-print" className="p-6">
              <div className="text-center border-b border-slate-200 pb-4 mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">MURG TEXTILE ENTERPRISES</div>
                <h2 className="text-base font-bold text-slate-900">CHANGE COLLECTION RECEIPT</h2>
                <div className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold">
                  ✓ CASH CHANGE COLLECTED
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-slate-500 font-medium">Receipt No:</span>
                  <span className="font-bold font-mono text-emerald-800">{changeReceiptData.receipt_number || changeReceiptData.receiptNumber || '—'}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Customer:</span>
                    <span className="font-bold text-slate-900">{changeReceiptData.customer_name || changeReceiptData.customerName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Branch:</span>
                    <span className="font-semibold text-slate-700">{activeBranch}</span>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Collection Date:</span>
                    <span className="font-semibold text-slate-700">{changeReceiptData.date ? formatDate(changeReceiptData.date) : formatDate(new Date())}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-slate-500 font-medium">Payout Method:</span>
                    <span className="font-semibold text-slate-700">{changeReceiptData.payment_method || 'Cash'}</span>
                  </div>
                  {changeReceiptData.processed_by_name && (
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-slate-500 font-medium">Staff:</span>
                      <span className="font-semibold text-slate-700">{changeReceiptData.processed_by_name}</span>
                    </div>
                  )}
                </div>

                {/* Financial Ledger Box */}
                <div className="border-t-2 border-slate-200 pt-3 mt-3 bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-medium">Change Balance Before:</span>
                    <span className="font-bold font-mono text-slate-800">
                      ₦{(parseFloat(changeReceiptData.previous_change ?? changeReceiptData.previousCredit) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-rose-700 border-t border-slate-200 pt-2">
                    <span className="font-bold">Amount Collected:</span>
                    <span className="font-extrabold font-mono text-base text-rose-700">
                      -₦{(parseFloat(changeReceiptData.amount_collected ?? changeReceiptData.amount) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t-2 border-slate-300 pt-2 bg-emerald-50 -mx-3 -mb-3 p-3 rounded-b-lg">
                    <span className="font-bold text-slate-900">Remaining Change:</span>
                    <span className="font-extrabold font-mono text-base text-emerald-800">
                      ₦{(parseFloat(changeReceiptData.remaining_change ?? changeReceiptData.newCredit) || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="border-t-2 border-dashed border-slate-300 pt-3 mt-3 text-center">
                  <div className="text-[10px] text-slate-500">
                    This receipt confirms customer change payout at the branch.<br />
                    <strong className="text-emerald-700">CHANGE PAYOUT CONFIRMED — OFFICIAL RECORD.</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => setChangeReceiptData(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal — Deposits, Credit/Change Ledger, & Credit Items */}
      {historyModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div id="customer-history-print" className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
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
                  Debt: <strong className="text-amber-800 font-mono">₦{(selectedCustomer.outstanding_balance || 0).toLocaleString()}</strong> • Available Change: <strong className="text-emerald-800 font-mono">₦{(selectedCustomer.credit_balance || 0).toLocaleString()}</strong> · Branch: {activeBranch}
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
            <div className="flex border-b border-slate-200 mb-4 shrink-0 overflow-x-auto">
              <button
                onClick={() => setHistoryTab('deposits')}
                className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
                  historyTab === 'deposits'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Deposit Payments ({historyList.length})
              </button>
              <button
                onClick={() => setHistoryTab('credit')}
                className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
                  historyTab === 'credit'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Customer Change / Credit Ledger ({creditHistoryList.length})
              </button>
              <button
                onClick={() => setHistoryTab('debt')}
                className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
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
                      <span className="font-mono text-[10px] text-slate-500 block">{d.transaction_id || d.receipt_number}</span>
                      <span className="font-bold text-slate-800">{d.payment_method || 'Cash'}</span>
                      <span className="text-slate-500 text-[11px] block">
                        {d.deposit_date ? new Date(d.deposit_date).toLocaleString() : 'Date unavailable'}
                      </span>
                      {d.description && <span className="text-slate-400 text-[10px] block italic">{d.description}</span>}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-700 block">
                        +₦{parseFloat(d.amount).toLocaleString()}
                      </span>
                      <div className="text-[10px] text-slate-500 flex flex-col items-end">
                        {d.previous_balance != null && !isNaN(parseFloat(d.previous_balance)) && (
                          <span>Before: ₦{parseFloat(d.previous_balance).toLocaleString()}</span>
                        )}
                        <span className="font-semibold text-slate-700">
                          After: {d.new_balance != null && !isNaN(parseFloat(d.new_balance))
                            ? '₦' + parseFloat(d.new_balance).toLocaleString()
                            : 'N/A'}
                        </span>
                      </div>
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

            {/* Credit / Change Ledger Tab */}
            {!historyLoading && historyTab === 'credit' && (
              <div className="overflow-auto flex-1 space-y-2">
                {creditHistoryList.map((tx) => {
                  const isAdd = tx.transaction_type === 'OVERPAYMENT_DEPOSIT';
                  const badgeColor = isAdd
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : tx.transaction_type === 'CASH_COLLECTED'
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : 'bg-purple-100 text-purple-900 border-purple-300';
                  const label = isAdd
                    ? 'Deposit Overpayment (+Change)'
                    : tx.transaction_type === 'CASH_COLLECTED'
                    ? 'Cash Collected (-Change)'
                    : 'Used For Purchase (-Change)';

                  return (
                    <div key={tx.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                            {label}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">{tx.receipt_number || tx.reference_id}</span>
                        </div>
                        <span className="text-slate-500 text-[11px] block">
                          {tx.date ? new Date(tx.date).toLocaleString() : 'Date unavailable'} • Method: {tx.payment_method || 'Cash'}
                        </span>
                        {tx.notes && <span className="text-slate-400 text-[10px] block italic">{tx.notes}</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black block ${isAdd ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isAdd ? '+' : '-'}₦{parseFloat(tx.amount).toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-500 flex flex-col items-end">
                          <span>Change Before: ₦{parseFloat(tx.previous_balance || 0).toLocaleString()}</span>
                          <span className="font-bold text-slate-800">Change After: ₦{parseFloat(tx.new_balance || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {creditHistoryList.length === 0 && (
                  <p className="text-center py-6 text-slate-400 text-xs">No change credit activity on record.</p>
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
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">MURG TEXTILE ENTERPRISES</div>
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
                    <span className="font-semibold text-slate-700">{printReceiptData.payment_method || 'Cash'}</span>
                  </div>
                </div>

                {/* Clear Financial Before & After Ledger Box */}
                <div className="border-t-2 border-slate-200 pt-3 mt-3 bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-medium">Outstanding Debt Before:</span>
                    <span className="font-bold font-mono text-slate-800">
                      {printReceiptData.previous_balance != null && !isNaN(parseFloat(printReceiptData.previous_balance))
                        ? '₦' + parseFloat(printReceiptData.previous_balance).toLocaleString()
                        : '₦' + (parseFloat(printReceiptData.amount || 0) + parseFloat(printReceiptData.new_balance || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-800 border-t border-slate-200 pt-2">
                    <span className="font-bold">Total Deposit Paid:</span>
                    <span className="font-extrabold font-mono text-base text-emerald-700">
                      -₦{parseFloat(printReceiptData.amount || 0).toLocaleString()}
                    </span>
                  </div>

                  {printReceiptData.overpayment > 0 && (
                    <div className="flex justify-between items-center text-emerald-900 bg-emerald-100/70 p-1.5 rounded text-[11px] border border-emerald-300">
                      <span className="font-bold">Change Added to Customer Balance:</span>
                      <span className="font-extrabold font-mono text-emerald-900">
                        +₦{parseFloat(printReceiptData.overpayment).toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t-2 border-slate-300 pt-2 bg-emerald-50 -mx-3 -mb-3 p-3 rounded-b-lg">
                    <span className="font-bold text-slate-900">Outstanding Debt After:</span>
                    <div className="text-right">
                      <span className="font-extrabold font-mono text-base text-slate-900 block">
                        {printReceiptData.new_balance != null && !isNaN(parseFloat(printReceiptData.new_balance))
                          ? (parseFloat(printReceiptData.new_balance) === 0 ? '₦0' : '₦' + parseFloat(printReceiptData.new_balance).toLocaleString())
                          : (printReceiptData.remainingBalance != null ? '₦' + parseFloat(printReceiptData.remainingBalance).toLocaleString() : '₦0')}
                      </span>
                      {((printReceiptData.new_balance != null && parseFloat(printReceiptData.new_balance) === 0) ||
                        (printReceiptData.remainingBalance != null && parseFloat(printReceiptData.remainingBalance) === 0)) && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          DEBT CLEARED IN FULL ✓
                        </span>
                      )}
                    </div>
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
