import { useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function ReturnsPage() {
  const { user } = useAuthStore();
  const [orderID, setOrderID] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [validation, setValidation] = useState(null);

  const handleValidate = async () => {
    if (!orderID.trim()) {
      setError('Please enter an order ID');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setValidation(null);

    try {
      const response = await api.get(`/returns/validate/${orderID}`);
      setValidation(response.data.data);
      setSuccess('Order can be returned');
    } catch (err) {
      setError(err.response?.data?.message || 'Order not found or cannot be returned');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!orderID.trim()) {
      setError('Please enter an order ID');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post('/returns/process', { orderID });
      setSuccess(response.data.message);
      setOrderID('');
      setValidation(null);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order Returns</h1>
        <p className="text-gray-600">Return completed orders to cart and restore stock</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        <h2 className="text-xl font-bold mb-4">Return Order to Cart</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter Invoice Number <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={orderID}
            onChange={(e) => setOrderID(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter Order ID"
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleValidate}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition disabled:opacity-50"
          >
            {loading ? 'Validating...' : 'Validate Order'}
          </button>
          <button
            onClick={handleReturn}
            disabled={loading || !validation}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Return to Cart'}
          </button>
        </div>

        {validation && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="font-semibold text-blue-900 mb-2">Order Details</h3>
            <div className="text-sm text-blue-800">
              <p><strong>Order ID:</strong> {validation.orderID}</p>
              <p><strong>Status:</strong> {validation.canReturn ? 'Can be returned' : 'Cannot be returned'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
