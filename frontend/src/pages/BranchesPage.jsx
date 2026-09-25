import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import {
  Building2,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Users,
  X,
} from 'lucide-react';

export default function BranchesPage() {
  const { branches, fetchBranches } = useBranchStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [salesMode, setSalesMode] = useState('DEALER');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenCreate = () => {
    setEditMode(false);
    setEditingBranch(null);
    setName('');
    setAddress('');
    setPhone('');
    setSalesMode('DEALER');
    setModalOpen(true);
  };

  const handleOpenEdit = (branch) => {
    setEditMode(true);
    setEditingBranch(branch);
    setName(branch.name);
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setSalesMode(branch.sales_mode || 'DEALER');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editMode) {
        await api.put(`/branches/${editingBranch.facilityID}`, { name, address, phone, sales_mode: salesMode });
        alert('Branch details updated successfully!');
      } else {
        await api.post('/branches', { name, address, phone, sales_mode: salesMode });
        alert('New retail branch created successfully!');
      }
      setModalOpen(false);
      fetchBranches();
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (branch) => {
    const nextStatus = branch.status === 'active' ? 'inactive' : 'active';
    const action = nextStatus === 'active' ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} branch "${branch.name}"?`)) return;

    try {
      await api.patch(`/branches/${branch.facilityID}/status`, { status: nextStatus });
      fetchBranches();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update branch status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0">Retail Branch Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Global Admin control center: configure physical branches, locations, and operational statuses
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Retail Branch</span>
        </button>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b) => (
          <div
            key={b.facilityID}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {b.facilityID}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded ${
                      b.sales_mode === 'PER_YARD'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {b.sales_mode === 'PER_YARD' ? 'PER YARD' : 'DEALER'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                      b.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {b.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span className="uppercase">{b.status || 'Active'}</span>
                  </span>
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 m-0">{b.name}</h3>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{b.address || 'No physical address specified'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{b.phone || 'No contact phone specified'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{b.staff_count || 0} Staff assigned</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleOpenEdit(b)}
                className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Details</span>
              </button>

              <button
                onClick={() => handleToggleStatus(b)}
                className={`text-[11px] font-bold py-1 px-2.5 rounded cursor-pointer ${
                  b.status === 'active'
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                {b.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">
              {editMode ? `Edit Branch: ${editingBranch.name}` : 'Create New Retail Branch'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sabon Gari Branch"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operational Sales Mode *</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${
                      salesMode === 'DEALER'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sales_mode"
                      value="DEALER"
                      checked={salesMode === 'DEALER'}
                      onChange={() => setSalesMode('DEALER')}
                      className="text-indigo-600"
                    />
                    <div>
                      <span className="block text-xs font-bold">DEALER / BELT</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Wholesale, belt-based</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${
                      salesMode === 'PER_YARD'
                        ? 'border-purple-600 bg-purple-50/50 text-purple-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sales_mode"
                      value="PER_YARD"
                      checked={salesMode === 'PER_YARD'}
                      onChange={() => setSalesMode('PER_YARD')}
                      className="text-purple-600"
                    />
                    <div>
                      <span className="block text-xs font-bold">PER YARD RETAIL</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Fabric cutting, per-yard</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Physical Location Address</label>
                <input
                  type="text"
                  placeholder="e.g. 45 France Road, Sabon Gari, Kano"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 08025493838"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Create Branch'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
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
