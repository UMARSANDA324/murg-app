import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function ExpensesPage() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    item: '',
    price: '',
    type: 'in',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    loadDashboard();
    loadExpenses();
  }, [typeFilter, fromDate, toDate]);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/expenses/dashboard');
      setDashboard(response.data.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const response = await api.get('/expenses', { params });
      setExpenses(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to load expenses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.item || !formData.price || !formData.type) {
      setFormError('All fields are required');
      return;
    }

    try {
      await api.post('/expenses', {
        item: formData.item,
        price: parseFloat(formData.price),
        type: formData.type,
      });
      setFormSuccess('Expense added successfully');
      setFormData({ item: '', price: '', type: 'in' });
      loadExpenses();
      loadDashboard();
      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess('');
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to add expense');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.item || !formData.price || !formData.type) {
      setFormError('All fields are required');
      return;
    }

    try {
      await api.put(`/expenses/${editingExpense.id}`, {
        item: formData.item,
        price: parseFloat(formData.price),
        type: formData.type,
      });
      setFormSuccess('Expense updated successfully');
      loadExpenses();
      loadDashboard();
      setTimeout(() => {
        setShowEditModal(false);
        setFormSuccess('');
        setEditingExpense(null);
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update expense');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Archive this expense from the active expense list? The historical financial record will be retained and remain included in financial totals.')) return;

    try {
      await api.delete(`/expenses/${id}`);
      loadExpenses();
      loadDashboard();
    } catch (err) {
      setError('Failed to delete expense');
    }
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setFormData({
      item: expense.item,
      price: expense.price,
      type: expense.type,
    });
    setShowEditModal(true);
  };

  const resetFilters = () => {
    setTypeFilter('');
    setFromDate('');
    setToDate('');
  };

  const calculateTotals = () => {
    const totalIn = expenses
      .filter(e => e.type === 'in')
      .reduce((sum, e) => sum + parseFloat(e.price), 0);
    const totalOut = expenses
      .filter(e => e.type === 'out')
      .reduce((sum, e) => sum + parseFloat(e.price), 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  if (loading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading expenses...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Expense Tracking</h1>
        <p className="text-gray-600">Track branch expenses by type and date</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
            <div className="text-sm opacity-80">Today's In</div>
            <div className="text-2xl font-bold">{formatCurrency(dashboard.today?.today_in || 0)}</div>
          </div>
          <div className="bg-red-500 text-white p-6 rounded-lg shadow">
            <div className="text-sm opacity-80">Today's Out</div>
            <div className="text-2xl font-bold">{formatCurrency(dashboard.today?.today_out || 0)}</div>
          </div>
          <div className="bg-green-500 text-white p-6 rounded-lg shadow">
            <div className="text-sm opacity-80">Total In (All Time)</div>
            <div className="text-2xl font-bold">{formatCurrency(dashboard.allTime?.total_in || 0)}</div>
          </div>
          <div className="bg-yellow-500 text-white p-6 rounded-lg shadow">
            <div className="text-sm opacity-80">Total Out (All Time)</div>
            <div className="text-2xl font-bold">{formatCurrency(dashboard.allTime?.total_out || 0)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Add Button */}
      <div className="mb-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
        >
          Add New Expense
        </button>
      </div>

      {/* Expenses Table */}
      <div className="min-w-0 overflow-x-auto rounded-lg bg-white shadow print:overflow-visible">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S/N</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense, index) => (
              <tr key={expense.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{expense.item}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(expense.price)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {expense.type === 'in' ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">In</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Out</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(expense.creation).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <button
                    onClick={() => openEditModal(expense)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan="2" className="px-6 py-3 text-sm font-bold text-gray-900">Total In (This View)</td>
              <td colSpan="4" className="px-6 py-3 text-sm font-bold text-gray-900">{formatCurrency(calculateTotals().totalIn)}</td>
            </tr>
            <tr>
              <td colSpan="2" className="px-6 py-3 text-sm font-bold text-gray-900">Total Out (This View)</td>
              <td colSpan="4" className="px-6 py-3 text-sm font-bold text-gray-900">{formatCurrency(calculateTotals().totalOut)}</td>
            </tr>
            <tr className="bg-blue-100">
              <td colSpan="2" className="px-6 py-3 text-sm font-bold text-gray-900">Net Difference</td>
              <td colSpan="4" className="px-6 py-3 text-sm font-bold text-gray-900">{formatCurrency(calculateTotals().net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">New Expense</h2>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
                {formSuccess}
              </div>
            )}
            <form onSubmit={handleAdd}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                <input
                  type="text"
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Fuel, Maintenance"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="in">In</option>
                  <option value="out">Out</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ item: '', price: '', type: 'in' });
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                >
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Expense</h2>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
                {formSuccess}
              </div>
            )}
            <form onSubmit={handleEdit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                <input
                  type="text"
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="in">In</option>
                  <option value="out">Out</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingExpense(null);
                    setFormData({ item: '', price: '', type: 'in' });
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                >
                  Update Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
