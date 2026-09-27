import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useBranchStore } from '../store/useBranchStore';

export default function StoresPage() {
  const { user } = useAuthStore();
  const { branches, activeBranch, fetchBranches } = useBranchStore();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [formData, setFormData] = useState({
    storeName: '',
    branchId: '',
    status: 'active',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    fetchBranches();
    loadStores();
  }, [activeBranch]);

  const loadStores = async () => {
    try {
      setLoading(true);
      const params = activeBranch ? { branchId: activeBranch } : {};
      const response = await api.get('/stocks/stores', { params });
      setStores(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to load stores');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.storeName || !formData.branchId) {
      setFormError('Store name and branch are required');
      return;
    }

    try {
      await api.post('/stocks/stores', {
        storeName: formData.storeName,
        branchId: formData.branchId,
        status: formData.status,
      });
      setFormSuccess('Store created successfully');
      setFormData({ storeName: '', branchId: '', status: 'active' });
      loadStores();
      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess('');
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create store');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.storeName || !formData.branchId) {
      setFormError('Store name and branch are required');
      return;
    }

    try {
      await api.put(`/stocks/stores/${editingStore.id}`, {
        storeName: formData.storeName,
        branchId: formData.branchId,
        status: formData.status,
      });
      setFormSuccess('Store updated successfully');
      loadStores();
      setTimeout(() => {
        setShowEditModal(false);
        setFormSuccess('');
        setEditingStore(null);
      }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update store');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this store? This will deactivate it.')) return;

    try {
      const params = activeBranch ? { branchId: activeBranch } : {};
      await api.delete(`/stocks/stores/${id}`, { params });
      loadStores();
    } catch (err) {
      setError('Failed to delete store');
    }
  };

  const openEditModal = (store) => {
    setEditingStore(store);
    setFormData({
      storeName: store.store_name,
      branchId: store.branch_id,
      status: store.status,
    });
    setShowEditModal(true);
  };

  const canManageStores = user?.isGlobalAdmin || user?.role === 'Admin';

  if (loading && stores.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading stores...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Store Management</h1>
        <p className="text-gray-600">Manage physical stores within branches</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Branch Filter */}
      {user?.isGlobalAdmin && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            value={activeBranch || ''}
            onChange={(e) => {
              const branchId = e.target.value;
              if (branchId) {
                // Set active branch and reload stores
                localStorage.setItem('activeBranch', branchId);
                window.location.reload();
              }
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.facilityID} value={b.facilityID}>
                {b.name} ({b.facilityID})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Add Button */}
      {canManageStores && (
        <div className="mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
          >
            Add New Store
          </button>
        </div>
      )}

      {/* Stores Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S/N</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stores.map((store, index) => (
              <tr key={store.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{store.store_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{store.branch_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {store.status === 'active' ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {canManageStores && (
                    <>
                      <button
                        onClick={() => openEditModal(store)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(store.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">New Store</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Main Warehouse, Store A"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => (
                    <option key={b.facilityID} value={b.facilityID}>
                      {b.name} ({b.facilityID})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ storeName: '', branchId: '', status: 'active' });
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
                  Create Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingStore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Store</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.facilityID} value={b.facilityID}>
                      {b.name} ({b.facilityID})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStore(null);
                    setFormData({ storeName: '', branchId: '', status: 'active' });
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
                  Update Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
