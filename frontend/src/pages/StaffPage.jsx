import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  Users,
  Plus,
  ShieldCheck,
  Building2,
  Lock,
  UserCheck,
  UserX,
  X,
  Mail,
  Phone,
} from 'lucide-react';
import PasswordInput from '../components/PasswordInput';

export default function StaffPage() {
  const { branches } = useBranchStore();
  const { user } = useAuthStore();
  const [staffList, setStaffList] = useState([]);
  const [filterBranch, setFilterBranch] = useState('');
  const [loading, setLoading] = useState(false);

  // New Staff Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('Staff');
  const [newBranch, setNewBranch] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  // Edit Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [editEmailModalOpen, setEditEmailModalOpen] = useState(false);
  const [editPasswordModalOpen, setEditPasswordModalOpen] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    fetchStaff();
  }, [filterBranch]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      let url = '/staff';
      if (filterBranch) url += `?branchId=${filterBranch}`;
      const res = await api.get(url);
      setStaffList(res.data.data || []);
    } catch (err) {
      console.error('[Staff] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setCreateSaving(true);
    try {
      await api.post('/staff', {
        name: newName,
        email: newEmail,
        phone: newPhone,
        role: newRole,
        facilityID: newBranch,
        password: newPassword,
      });

      setCreateModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      fetchStaff();
      alert('Staff member registered successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create staff member.');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleToggleStatus = async (staffMember) => {
    const nextStatus = staffMember.status === 1 ? 0 : 1;
    const action = nextStatus === 1 ? 'activate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} ${staffMember.name}?`)) return;

    try {
      await api.patch(`/staff/${staffMember.id}/status`, { status: nextStatus });
      fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleDeleteUser = async (staffMember) => {
    if (staffMember.id === user.id) return alert('You cannot delete yourself.');
    if (!window.confirm(`Are you sure you want to permanently delete user ${staffMember.name}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/staff/${staffMember.id}`);
      fetchStaff();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/staff/${selectedUser.id}/email`, { email: editEmail });
      setEditEmailModalOpen(false);
      fetchStaff();
      alert('Email updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update email.');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/staff/${selectedUser.id}/password`, { password: editPassword });
      setEditPasswordModalOpen(false);
      alert('Password updated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update password.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0">Staff & Role Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Assign staff members to physical branches, assign roles, and configure permissions
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Staff</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-600">Filter by Branch:</label>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.facilityID} value={b.facilityID}>
              {b.name} ({b.facilityID})
            </option>
          ))}
        </select>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">Assigned Branch</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Account Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900">{s.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{s.email}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-indigo-700">{s.branch_name || s.facilityID}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{s.facilityID}</div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.role === 'Admin'
                        ? 'bg-purple-100 text-purple-800'
                        : s.role === 'Sub-admin'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {s.role === 'Admin' ? 'Global Admin' : s.role === 'Sub-admin' ? 'Branch Manager' : 'Cashier'}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-600 font-mono">{s.phone || 'N/A'}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {s.status === 1 ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {s.id !== user?.id && (
                    <div className="flex items-center justify-center gap-2">
                      {s.role !== 'Admin' && (
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`text-[11px] font-bold py-1 px-2.5 rounded cursor-pointer ${
                            s.status === 1
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {s.status === 1 ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                      {user?.isGlobalAdmin && (
                        <>
                          <button
                            onClick={() => { setSelectedUser(s); setEditEmail(s.email); setEditEmailModalOpen(true); }}
                            className="text-[11px] font-bold py-1 px-2.5 rounded text-blue-600 hover:bg-blue-50 cursor-pointer"
                          >
                            Edit Email
                          </button>
                          <button
                            onClick={() => { setSelectedUser(s); setEditPassword(''); setEditPasswordModalOpen(true); }}
                            className="text-[11px] font-bold py-1 px-2.5 rounded text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          >
                            Reset Pwd
                          </button>
                          <button
                            onClick={() => handleDeleteUser(s)}
                            className="text-[11px] font-bold py-1 px-2.5 rounded text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {staffList.length === 0 && (
              <tr>
                <td colSpan="6" className="py-8 text-center text-slate-400">
                  No staff members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Staff Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">Register Branch Staff</h3>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bilya Ibrahim"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="staff@murg.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="08012345678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Branch *</label>
                  <select
                    required
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option value="">-- Choose Branch --</option>
                    {branches.map((b) => (
                      <option key={b.facilityID} value={b.facilityID}>
                        {b.name} ({b.facilityID})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option value="Staff">Cashier (Staff)</option>
                    <option value="Sub-admin">Branch Manager</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Login Password *</label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-slate-50"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={createSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs"
                >
                  {createSaving ? 'Registering...' : 'Register Staff Member'}
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

      {/* Edit Email Modal */}
      {editEmailModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button onClick={() => setEditEmailModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-base font-bold text-slate-900 mb-4">Edit User Email</h3>
            <form onSubmit={handleUpdateEmail} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Email Address *</label>
                <input type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs" />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs cursor-pointer">Update Email</button>
                <button type="button" onClick={() => setEditEmailModalOpen(false)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Password Modal */}
      {editPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button onClick={() => setEditPasswordModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            <h3 className="text-base font-bold text-slate-900 mb-4">Reset User Password</h3>
            <form onSubmit={handleUpdatePassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
                <PasswordInput value={editPassword} onChange={(e) => setEditPassword(e.target.value)} required placeholder="••••••••" className="bg-slate-50" />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs cursor-pointer">Update Password</button>
                <button type="button" onClick={() => setEditPasswordModalOpen(false)} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
