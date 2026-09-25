import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  Building2,
  X,
  AlertTriangle,
} from 'lucide-react';

export default function ShipmentsPage() {
  const { activeBranch, branches } = useBranchStore();
  const { user } = useAuthStore();
  const [shipments, setShipments] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create Transfer Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [destBranch, setDestBranch] = useState('');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [sendQuantity, setSendQuantity] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Inspect / Receive Modal State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingShipment, setInspectingShipment] = useState(null);
  const [receivingCounts, setReceivingCounts] = useState({});
  const [receivingSaving, setReceivingSaving] = useState(false);

  useEffect(() => {
    if (activeBranch) {
      fetchShipments();
      fetchSourceStocks();
    }
  }, [activeBranch]);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/shipments');
      setShipments(res.data.data || []);
    } catch (err) {
      console.error('[Shipments] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSourceStocks = async () => {
    try {
      const res = await api.get(`/stocks?branchId=${activeBranch}`);
      setStocks(res.data.data || []);
    } catch (err) {
      console.error('[Shipments] Fetch stocks failed:', err);
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    if (!destBranch) {
      alert('Please select a destination branch.');
      return;
    }

    if (destBranch === activeBranch) {
      alert('Source and destination branches cannot be the same.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/shipments', {
        sourceBranch: activeBranch,
        destinationBranch: destBranch,
        items: [
          {
            stockId: parseInt(selectedStockId),
            quantity: parseFloat(sendQuantity),
          },
        ],
        notes: transferNotes,
      });

      setModalOpen(false);
      setSelectedStockId('');
      setSendQuantity('');
      setTransferNotes('');
      fetchShipments();
      fetchSourceStocks();
      alert('Shipment dispatched! Inventory deducted from source branch and marked In Transit.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to dispatch shipment.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInspect = async (shipmentId) => {
    try {
      const res = await api.get(`/shipments/${shipmentId}`);
      const shipment = res.data.data;
      setInspectingShipment(shipment);

      // Pre-fill receiving counts with sent quantities
      const counts = {};
      shipment.items?.forEach((i) => {
        counts[i.id] = i.quantity_sent;
      });
      setReceivingCounts(counts);
      setInspectModalOpen(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load shipment details.');
    }
  };

  const handleConfirmReceive = async () => {
    setReceivingSaving(true);
    try {
      const receivedItems = inspectingShipment.items?.map((item) => ({
        id: item.id,
        quantityReceived: parseFloat(receivingCounts[item.id] || item.quantity_sent),
      }));

      await api.post(`/shipments/${inspectingShipment.id}/receive`, {
        receivedItems,
        destinationBranch: activeBranch,
      });

      setInspectModalOpen(false);
      fetchShipments();
      fetchSourceStocks();
      alert('Shipment verified and received! Destination inventory successfully updated.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm receipt.');
    } finally {
      setReceivingSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0">Inter-Branch Stock Transfers</h2>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch, track in-transit goods, and verify arrivals with zero phantom inventory
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Inter-Branch Transfer</span>
        </button>
      </div>

      {/* Shipments List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Tracking No</th>
              <th className="py-3 px-4">Origin $\to$ Destination</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Items</th>
              <th className="py-3 px-4">Dispatched By</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shipments.map((s) => {
              const isDestination = s.destination_branch === activeBranch;
              const isPendingReceive = s.status === 'In Transit' && isDestination;

              return (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {s.tracking_number}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span>{s.source_branch_name || s.source_branch}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-indigo-700">{s.destination_branch_name || s.destination_branch}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'Received'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'In Transit'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {s.status === 'Received' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{s.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-700">
                    {s.total_quantity_sent || s.item_count || 1} units
                  </td>
                  <td className="py-3 px-4 text-slate-500">{s.dispatched_by_name || 'Staff'}</td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isPendingReceive ? (
                      <button
                        onClick={() => handleOpenInspect(s.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] py-1 px-2.5 rounded shadow-xs cursor-pointer"
                      >
                        Inspect & Receive
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenInspect(s.id)}
                        className="text-slate-500 hover:text-slate-800 text-[11px] font-medium underline"
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {shipments.length === 0 && (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-400">
                  No transfer shipments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Transfer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">Dispatch Inter-Branch Transfer</h3>
            <p className="text-xs text-slate-500 mb-4">
              Stock will be deducted from <strong>{activeBranch}</strong> immediately upon dispatch.
            </p>

            <form onSubmit={handleCreateShipment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Branch *</label>
                <select
                  required
                  value={destBranch}
                  onChange={(e) => setDestBranch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="">-- Choose Destination Branch --</option>
                  {branches
                    .filter((b) => b.facilityID !== activeBranch)
                    .map((b) => (
                      <option key={b.facilityID} value={b.facilityID}>
                        {b.name} ({b.facilityID})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Product to Transfer *</label>
                <select
                  required
                  value={selectedStockId}
                  onChange={(e) => setSelectedStockId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                >
                  <option value="">-- Choose In-Stock Product --</option>
                  {stocks
                    .filter((s) => s.quantity > 0)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Available: {s.quantity} {s.unit_type})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Quantity *</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 10"
                  value={sendQuantity}
                  onChange={(e) => setSendQuantity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Waybill / Driver Notes</label>
                <input
                  type="text"
                  placeholder="Driver name, vehicle plate, or transfer reason"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs"
                >
                  {saving ? 'Dispatching Transfer...' : 'Dispatch Shipment'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect & Receive Modal */}
      {inspectModalOpen && inspectingShipment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-auto">
            <button
              onClick={() => setInspectModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Transfer Manifest: {inspectingShipment.tracking_number}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              From: {inspectingShipment.source_branch_name} $\to$ To: {inspectingShipment.destination_branch_name}
            </p>

            <div className="space-y-3 mb-6">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Line Items
              </span>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                {inspectingShipment.items?.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 m-0">{item.product_name}</p>
                      <p className="text-slate-500 m-0 text-[11px]">Sent: {item.quantity_sent} units</p>
                    </div>

                    {inspectingShipment.status === 'In Transit' && inspectingShipment.destination_branch === activeBranch ? (
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-slate-600">Verified Qty:</label>
                        <input
                          type="number"
                          step="any"
                          value={receivingCounts[item.id] ?? item.quantity_sent}
                          onChange={(e) =>
                            setReceivingCounts({ ...receivingCounts, [item.id]: e.target.value })
                          }
                          className="w-20 bg-white border border-slate-300 rounded p-1 text-right font-bold text-xs"
                        />
                      </div>
                    ) : (
                      <span className="font-bold text-slate-800">
                        Received: {item.quantity_received || item.quantity_sent} units
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {inspectingShipment.status === 'In Transit' && inspectingShipment.destination_branch === activeBranch ? (
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmReceive}
                  disabled={receivingSaving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{receivingSaving ? 'Crediting Inventory...' : 'Confirm Arrival & Accept Goods'}</span>
                </button>
                <button
                  onClick={() => setInspectModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            ) : (
              <button
                onClick={() => setInspectModalOpen(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-xs"
              >
                Close Manifest
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
