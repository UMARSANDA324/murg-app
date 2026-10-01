import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useBranchStore } from '../store/useBranchStore';
import { useAuthStore } from '../store/useAuthStore';
import { Printer, RefreshCw } from 'lucide-react';
import { getBusinessDate } from '../utils/dateUtils';

const today = getBusinessDate();
const firstOfMonth = `${today.slice(0, 7)}-01`;

function formatCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Unavailable';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' });
}

export default function FinancialReportsPage() {
  const [searchParams] = useSearchParams();
  const { branches, fetchBranches } = useBranchStore();
  const { user } = useAuthStore();
  const [reportType, setReportType] = useState('financial');
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || 'all');
  const [customerId, setCustomerId] = useState('');
  const [period, setPeriod] = useState(searchParams.get('period') || 'week');
  const [weekStart, setWeekStart] = useState(searchParams.get('weekStart') || today);
  const [month, setMonth] = useState(String(Number(today.slice(5, 7))));
  const [year, setYear] = useState(today.slice(0, 4));
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const branchOptions = useMemo(
    () => branches.filter((branch) => branch.facilityID),
    [branches]
  );

  useEffect(() => {
    fetchBranches(user);
  }, [fetchBranches, user]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    setReport(null);
    try {
      let response;
      if (reportType === 'financial') {
        const params = { branchId, period };
        if (period === 'week') params.weekStart = weekStart;
        if (period === 'month' || period === 'year') params.year = year;
        if (period === 'month') params.month = month;
        if (period === 'custom') {
          params.startDate = startDate;
          params.endDate = endDate;
        }
        response = await api.get('/analytics/financial', { params });
      } else if (reportType === 'debtors') {
        response = await api.get('/analytics/debtors', {
          params: { branchId, ...(customerId ? { customerId } : {}) },
        });
      } else {
        const params = { branchId, period };
        if (period === 'week') params.weekStart = weekStart;
        if (period === 'month' || period === 'year') params.year = year;
        if (period === 'month') params.month = month;
        if (period === 'custom') {
          params.startDate = startDate;
          params.endDate = endDate;
        }
        response = await api.get('/analytics/history', {
          params,
        });
      }
      setReport(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Report could not be loaded.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, customerId, endDate, month, period, reportType, startDate, weekStart, year]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handlePrint = () => window.print();
  const title = report?.reportType || (reportType === 'financial' ? 'Financial Overview' : reportType);

  return (
    <main className="space-y-5">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: #fff !important; color: #111827 !important; }
          .report-no-print { display: none !important; }
          .report-print, .report-print * { visibility: visible !important; }
          .report-print { display: block !important; border: 0 !important; box-shadow: none !important; }
          .report-table-wrap { overflow: visible !important; }
          .report-table { min-width: 0 !important; width: 100% !important; font-size: 9pt !important; }
          .report-table tr { break-inside: avoid; }
        }
      `}</style>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-slate-900">Financial & Business Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Backend-calculated figures for the selected branch or entire business.
          </p>
        </div>
        <div className="report-no-print flex gap-2">
          <button type="button" onClick={loadReport} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={handlePrint} disabled={!report || loading} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
        </div>
      </header>

      <section className="report-no-print grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600">
          Report
          <select
            value={reportType}
            onChange={(event) => {
              setReportType(event.target.value);
              setReport(null);
            }}
            className="mt-1 w-full rounded border p-2 text-sm"
          >
            <option value="financial">Financial overview</option>
            <option value="debtors">Debtors / credit customers</option>
            <option value="history">Sales history / ledger</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Scope
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm">
            <option value="all">All Branches / Entire Business</option>
            {branchOptions.map((branch) => (
              <option key={branch.facilityID} value={branch.facilityID}>{branch.name} ({branch.facilityID})</option>
            ))}
          </select>
        </label>
        {reportType === 'debtors' && report?.debtors?.length > 0 && (
          <label className="text-xs font-semibold text-slate-600">
            Customer
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm">
              <option value="">All debtors</option>
              {report.debtors.map((debtor) => (
                <option key={`${debtor.branchId}:${debtor.customerId}`} value={debtor.customerId || ''}>
                  {debtor.customerName} — {debtor.branchId || 'Unassigned'}
                </option>
              ))}
            </select>
          </label>
        )}
        {(reportType === 'financial' || reportType === 'history') && (
          <label className="text-xs font-semibold text-slate-600">
            Period
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm">
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Custom date range</option>
            </select>
          </label>
        )}
        {(reportType === 'financial' || reportType === 'history') && period === 'week' && (
          <label className="text-xs font-semibold text-slate-600">
            Week containing
            <input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm" />
          </label>
        )}
        {(reportType === 'financial' || reportType === 'history') && (period === 'month' || period === 'year') && (
          <>
            {period === 'month' && (
              <label className="text-xs font-semibold text-slate-600">
                Month
                <select value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm">
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={String(index + 1)}>{new Date(2000, index, 1).toLocaleString('en', { month: 'long' })}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs font-semibold text-slate-600">
              Year
              <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm" />
            </label>
          </>
        )}
        {((reportType === 'financial' || reportType === 'history') && period === 'custom') && (
          <>
            <label className="text-xs font-semibold text-slate-600">
              From
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              To
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm" />
            </label>
          </>
        )}
      </section>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="text-sm text-slate-500">Loading report…</p>}

      {!loading && report && (
        <article className="report-print space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <header className="border-b pb-4 text-center">
            <p className="m-0 text-sm font-bold uppercase tracking-widest text-slate-700">{report.companyName || 'MURG Textile Enterprises'}</p>
            <h2 className="mb-1 mt-2 text-xl font-bold text-slate-900">{title}</h2>
            <p className="m-0 text-sm text-slate-600">
              {report.scope?.label || 'All Branches / Entire Business'}
              {report.period && ` · ${report.period.startDate} to ${report.period.endDate}`}
            </p>
            <p className="m-0 mt-1 text-xs text-slate-500">Generated: {formatDate(report.generatedAt || report.asOf)}</p>
          </header>

          {reportType === 'financial' && report.summary && (
            <>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Gross Sales" value={report.summary.sales?.grossSales} />
                <Metric label="Persisted Net Sales" value={report.summary.sales?.netSales} />
                <Metric label="Accounting Revenue" value={report.summary.accountingRevenue?.status === 'unavailable' ? null : report.summary.sales?.netSales} />
                <Metric label="COGS" value={report.summary.profitLoss?.cogs} />
                <Metric label="Gross Profit" value={report.summary.profitLoss?.grossProfit} />
                <Metric label="Net Profit / Loss" value={report.summary.profitLoss?.netProfitOrLoss} />
                <Metric label="Purchase Value" value={report.summary.purchases?.totalPurchaseValue} />
                <Metric label="Amount Spent on Purchases" value={report.summary.purchases?.amountSpent} />
                <Metric label="Recorded Expenses (Out)" value={report.summary.expenses?.recordedOut} />
                <Metric label="Recorded Expense Inflows" value={report.summary.expenses?.recordedIn} />
                <Metric label="Outstanding Debt (current snapshot)" value={report.summary.outstandingDebt?.balance} />
                <Metric label={report.summary.inventory?.label || 'Inventory Value'} value={report.summary.inventory?.recordedBuyingPriceValue} />
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="m-0 text-xs font-semibold text-amber-900">Profit / Loss: {report.summary.profitLoss?.status || 'Unavailable'}</p>
                  <p className="m-0 mt-1 text-xs text-amber-800">{report.summary.profitLoss?.reason || 'Financial calculation unavailable.'}</p>
                </div>
              </section>
              <p className="text-xs text-slate-500">
                Purchase value and amount actually paid are separate; neither is a purchase-capital balance. Total business capital is not calculated.
                Inventory value is current active quantity × recorded current buying price; it is not total business capital ({report.summary.inventory?.unvaluedProductCount ?? 0} active products lack a usable quantity or buying price).
                {' '}{report.summary.accountingRevenue?.reason}
                Net sales omit {report.dataQuality?.salesWithoutPersistedNetTotal ?? 0} orders without persisted net_total and {report.dataQuality?.salesWithConflictingPersistedNetTotal ?? 0} with conflicting line totals.
              </p>
              {report.dataQuality?.unmappedHistoricalRecords && Object.values(report.dataQuality.unmappedHistoricalRecords).some((count) => count > 0) && (
                <p className="text-xs text-amber-700">
                  Excluded from all-branch totals because no matching branch relationship exists: {report.dataQuality.unmappedHistoricalRecords.orderLines} order lines, {report.dataQuality.unmappedHistoricalRecords.purchaseRecords} purchases, {report.dataQuality.unmappedHistoricalRecords.expenseRecords} expenses, and {report.dataQuality.unmappedHistoricalRecords.debtRecords} positive-balance debt records. No branch was assigned to these records.
                </p>
              )}
              <ReportTable
                title="Branch Breakdown"
                headers={['Branch', 'Net Sales', 'Purchase Value', 'Amount Spent', 'Expenses Out', 'Debt Snapshot', 'Inventory Cost Value']}
                rows={(report.branchBreakdown || []).map((row) => [
                  `${row.branchName} (${row.facilityID})`,
                  formatCurrency(row.sales?.netSales),
                  formatCurrency(row.purchases?.purchaseValue),
                  formatCurrency(row.purchases?.amountSpent),
                  formatCurrency(row.expenses?.recordedOut),
                  formatCurrency(row.outstandingDebt?.balance),
                  formatCurrency(row.inventory?.recordedBuyingPriceValue),
                ])}
              />
              <ReportTable
                title="Purchase Transactions"
                headers={['Date', 'Branch', 'Product', 'Quantity', 'Purchase Value', 'Amount Paid', 'Balance']}
                rows={(report.purchaseTransactions?.items || []).map((purchase) => [
                  formatDate(purchase.purchaseDate),
                  purchase.facilityID,
                  purchase.productName || 'Unknown product',
                  purchase.quantity,
                  formatCurrency(purchase.totalCost),
                  formatCurrency(purchase.amountPaid),
                  formatCurrency(purchase.balance),
                ])}
              />
              {report.purchaseTransactions?.truncated && <p className="text-xs text-amber-700">Showing {report.purchaseTransactions.returned} of {report.purchaseTransactions.total} purchase records.</p>}
            </>
          )}

          {reportType === 'debtors' && report.totals && (
            <>
              <Metric label="Total Outstanding Balance" value={report.totals.outstandingBalance ?? null} />
              {report.unmappedDebts?.debtorCount > 0 && (
                <p className="text-xs text-amber-700">
                  Excluded from branch-associated debtor rows: {report.unmappedDebts.debtorCount} positive-balance debt records with no matching branch, totaling {formatCurrency(report.unmappedDebts.outstandingBalance)}. No branch was assigned.
                </p>
              )}
              {report.truncated && (
                <p className="text-xs text-amber-700">Showing {report.returnedDebtors} of {report.totals.customerCount ?? 0} debtor records. The outstanding balance total includes all matching records.</p>
              )}
              <ReportTable
                title="Debtors and Credit Customers"
                headers={['Customer', 'Contact', 'Branch', 'Outstanding', 'Last Payment', 'Credit Orders', 'Deposits']}
                rows={(report.debtors || []).map((debtor) => [
                  debtor.customerName,
                  [debtor.phone, debtor.email].filter(Boolean).join(' · ') || '—',
                  debtor.branchId || 'Unassigned',
                  formatCurrency(debtor.balance),
                  formatDate(debtor.lastPaymentDate),
                  debtor.debtHistory?.length ?? 0,
                  debtor.paymentHistory?.length ?? 0,
                ])}
              />
              <ReportTable
                title="Credit Sale History"
                headers={['Date', 'Customer', 'Branch', 'Order Reference', 'Sale Total', 'Amount Paid']}
                rows={(report.debtors || []).flatMap((debtor) => (debtor.debtHistory || []).map((order) => [
                  formatDate(order.date),
                  debtor.customerName,
                  debtor.branchId || 'Unassigned',
                  order.orderID,
                  formatCurrency(order.netTotal),
                  formatCurrency(order.amountPaid),
                ]))}
              />
              <ReportTable
                title="Debt Payment History"
                headers={['Date', 'Customer', 'Branch', 'Receipt', 'Amount', 'Method']}
                rows={(report.debtors || []).flatMap((debtor) => (debtor.paymentHistory || []).map((payment) => [
                  formatDate(payment.date),
                  debtor.customerName,
                  debtor.branchId || 'Unassigned',
                  payment.receiptNumber || '—',
                  formatCurrency(payment.amount),
                  payment.paymentMethod || '—',
                ]))}
              />
              {report.debtors?.some((debtor) => (
                debtor.debtHistoryTotal > debtor.debtHistory?.length ||
                debtor.paymentHistoryTotal > debtor.paymentHistory?.length
              )) && (
                <p className="text-xs text-amber-700">Per-customer credit sales and deposit history is capped at 100 newest records; current balance and full totals are preserved.</p>
              )}
            </>
          )}

          {reportType === 'history' && report.transactions && (
            <>
              <p className="text-sm text-slate-600">Transactions: {report.totalTransactions}{report.truncated ? ` (showing ${report.returnedTransactions})` : ''}</p>
              {(report.unmappedHistoricalRecords?.transactions > 0 || report.unmappedHistoricalRecords?.stockMovements > 0) && (
                <p className="text-xs text-amber-700">
                  Excluded records without a matching branch relationship: {report.unmappedHistoricalRecords.transactions} sales transactions and {report.unmappedHistoricalRecords.stockMovements} stock movements. No branch was assigned to these records.
                </p>
              )}
              <ReportTable
                title="Sales History / Ledger"
                headers={['Date', 'Reference', 'Type', 'Customer', 'Branch', 'Items', 'Quantity', 'Amount', 'Paid']}
                rows={(report.transactions || []).flatMap((transaction) => (transaction.items || []).map((item, index) => [
                  index === 0 ? formatDate(transaction.date) : '',
                  index === 0 ? transaction.orderID : '',
                  index === 0 ? (transaction.payment || 'Sale') : '',
                  index === 0 ? (transaction.customer || 'Retail Customer') : '',
                  index === 0 ? transaction.branchName : '',
                  item.item || 'Unknown item',
                  item.quantity ?? '—',
                  formatCurrency(item.amount),
                  index === 0 ? formatCurrency(transaction.amountPaid) : '',
                ]))}
              />
              <ReportTable
                title="Stock Movement Ledger"
                headers={['Date', 'Branch', 'Movement', 'Product', 'Reference', 'Quantity Change', 'Before', 'After']}
                rows={(report.stockMovements || []).map((movement) => [
                  formatDate(movement.createdAt),
                  movement.branchName,
                  movement.movementType,
                  movement.stockName || 'Unknown item',
                  [movement.referenceType, movement.referenceId].filter(Boolean).join(' / ') || '—',
                  movement.quantityChange,
                  movement.quantityBefore,
                  movement.quantityAfter,
                ])}
              />
              {report.stockMovementsTruncated && <p className="text-xs text-amber-700">Showing {report.returnedStockMovements} of {report.totalStockMovements} stock movement records.</p>}
            </>
          )}
        </article>
      )}
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <p className="m-0 text-xs font-medium text-slate-500">{label}</p>
      <p className="m-0 mt-1 break-words text-lg font-bold text-slate-900">{formatCurrency(value)}</p>
    </div>
  );
}

function ReportTable({ title, headers, rows }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-slate-800">{title}</h3>
      <div className="report-table-wrap overflow-x-auto rounded-lg border border-slate-200">
        <table className="report-table min-w-[720px] w-full border-collapse text-left text-xs">
          <thead className="bg-slate-50">
            <tr>{headers.map((header) => <th key={header} className="border-b px-2 py-2 font-semibold text-slate-600">{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="break-inside-avoid even:bg-slate-50/60">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="border-b px-2 py-2 align-top text-slate-700">{cell}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={headers.length} className="px-2 py-5 text-center text-slate-500">No records found for this selection.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
