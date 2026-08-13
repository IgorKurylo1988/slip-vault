import React, { useState, useEffect, useMemo } from 'react';
import { InvoiceData } from '../types';
import Button from './Button';
import { Search, Trash2, ShieldAlert, ArrowLeft, Loader2, CreditCard, Receipt, FileText, RefreshCw, X } from 'lucide-react';

interface AdminBoardProps {
  onClose: () => void;
  onViewInvoice: (invoice: InvoiceData) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getApiUrl = (path: string) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base = isLocal ? 'http://localhost:8000' : 'https://api.slip-vault.com';
  return `${base}${path}`;
};

const AdminBoard: React.FC<AdminBoardProps> = ({ onClose, onViewInvoice }) => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'INVOICE' | 'CREDIT_INVOICE'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchAllInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(getApiUrl('/api/admin/invoices'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Failed to fetch admin invoices' }));
        throw new Error(data.detail || 'Admin access required.');
      }
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllInvoices();
  }, []);

  const handleDelete = async (id: string, storeName: string) => {
    if (!confirm(`ADMIN ACTION: Are you sure you want to permanently delete receipt for "${storeName}" (${id})?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(getApiUrl(`/api/admin/invoices/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to delete receipt.');
      }
      setInvoices(prev => prev.filter(inv => inv.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesFilter = filter === 'ALL' || inv.type === filter;
      const matchesSearch = (inv.storeName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (inv.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ((inv as any).userId || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [invoices, filter, searchQuery]);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(invoices.map((i: any) => i.userId).filter(Boolean));
    const totalCredits = invoices.filter(i => i.type === 'CREDIT_INVOICE').reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    const totalSpend = invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT').reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    return {
      totalDocs: invoices.length,
      usersCount: uniqueUsers.size || 1,
      totalCredits,
      totalSpend,
      currency: invoices[0]?.currency || '₪'
    };
  }, [invoices]);

  return (
    <div className="w-full h-full bg-[#F8FAFC] dark:bg-[#070B14] flex flex-col overflow-hidden text-[#172033] dark:text-[#F8FAFC]">
      
      {/* Admin Navigation Header */}
      <header className="bg-[#111827] border-b border-[#334155] py-4 px-6 shadow-md flex items-center justify-between gap-4 shrink-0 text-white">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            aria-label="Exit Admin Board"
            className="w-[44px] h-[44px] rounded-[10px] bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
            title="Return to User View"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-[#F59E0B]" />
              <h1 className="text-lg font-black tracking-tight text-white">Admin Management Board</h1>
            </div>
            <p className="text-xs text-[#94A3B8]">System-wide Receipt Database & Control Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAllInvoices} 
            disabled={loading}
            aria-label="Refresh admin data"
            className="w-[44px] h-[44px] rounded-[10px] bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
            title="Refresh System Data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <Button onClick={onClose} variant="secondary" className="min-h-[44px] text-xs">
            Exit Admin View
          </Button>
        </div>
      </header>

      {/* Main Admin Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        
        {error ? (
          <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] dark:text-[#F87171] p-6 rounded-2xl flex flex-col items-center text-center max-w-md mx-auto">
            <ShieldAlert size={36} className="mb-2" />
            <h3 className="text-base font-bold mb-1">Access Denied</h3>
            <p className="text-xs mb-4">{error}</p>
            <p className="text-xs text-[#94A3B8]">Admin routes require an email ending with @slip-vault.com or admin privileges.</p>
            <Button onClick={onClose} variant="primary" className="mt-4 min-h-[44px]">Return to User Dashboard</Button>
          </div>
        ) : (
          <>
            {/* System Overview Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase block">System Receipts</span>
                  <span className="text-2xl font-black text-[#172033] dark:text-[#F8FAFC]">{stats.totalDocs}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase block">Active Users</span>
                  <span className="text-2xl font-black text-[#172033] dark:text-[#F8FAFC]">{stats.usersCount}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center shrink-0">
                  <Receipt size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase block">System Volume</span>
                  <span className="text-xl font-black text-[#172033] dark:text-[#F8FAFC] truncate block">
                    <span className="text-[#F59E0B] font-black mr-0.5">{stats.currency}</span>{stats.totalSpend.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase block">Total System Credits</span>
                  <span className="text-xl font-black text-[#2563EB] dark:text-[#60A5FA] truncate block">
                    <span className="text-[#F59E0B] font-black mr-0.5">{stats.currency}</span>{stats.totalCredits.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter & Admin Search Controls */}
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" size={18} />
                <input 
                  type="text"
                  placeholder="Search store, invoice #, user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#DCE3EC] dark:border-[#334155] rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => setFilter('ALL')}
                  className={`flex-1 md:flex-initial px-4 py-2.5 min-h-[44px] rounded-[10px] text-xs font-semibold ${filter === 'ALL' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}
                >
                  All ({invoices.length})
                </button>
                <button 
                  onClick={() => setFilter('INVOICE')}
                  className={`flex-1 md:flex-initial px-4 py-2.5 min-h-[44px] rounded-[10px] text-xs font-semibold ${filter === 'INVOICE' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}
                >
                  Invoices ({invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT').length})
                </button>
                <button 
                  onClick={() => setFilter('CREDIT_INVOICE')}
                  className={`flex-1 md:flex-initial px-4 py-2.5 min-h-[44px] rounded-[10px] text-xs font-semibold ${filter === 'CREDIT_INVOICE' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}
                >
                  Credits ({invoices.filter(i => i.type === 'CREDIT_INVOICE').length})
                </button>
              </div>
            </div>

            {/* Admin Management Table */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#DCE3EC] dark:border-[#334155] flex justify-between items-center bg-[#F8FAFC]/50 dark:bg-[#111827]">
                <h2 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC]">System Receipts Registry</h2>
                <span className="text-xs bg-[#2563EB]/10 text-[#2563EB] font-bold px-3 py-1 rounded-full">
                  {filteredInvoices.length} Documents Listed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCE3EC] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/40 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      <th className="px-6 py-3.5">Store Name</th>
                      <th className="px-6 py-3.5">Invoice #</th>
                      <th className="px-6 py-3.5">User ID</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Type</th>
                      <th className="px-6 py-3.5 text-right">Amount</th>
                      <th className="px-6 py-3.5 text-center">Admin Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EC] dark:divide-[#334155]">
                    {loading ? (
                      [1, 2, 3, 4].map(i => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-[#F1F5F9] dark:bg-[#1E293B] rounded"></div></td>
                        </tr>
                      ))
                    ) : filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                          No system receipts found matching query.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors text-xs">
                          <td className="px-6 py-4 font-semibold text-[#172033] dark:text-[#F8FAFC]">
                            <button 
                              onClick={() => onViewInvoice(inv)} 
                              className="hover:underline text-left"
                            >
                              {inv.storeName || 'Unknown Store'}
                            </button>
                          </td>
                          <td className="px-6 py-4 font-mono text-[#64748B] dark:text-[#CBD5E1] whitespace-nowrap">
                            {inv.invoiceNumber || '-'}
                          </td>
                          <td className="px-6 py-4 font-mono text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">
                            {(inv as any).userId || 'default'}
                          </td>
                          <td className="px-6 py-4 text-[#172033] dark:text-[#CBD5E1] whitespace-nowrap">
                            {formatDate(inv.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {inv.type === 'CREDIT_INVOICE' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]">
                                <CreditCard size={11} /> Credit
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-[#059669] dark:bg-emerald-950/40 dark:text-[#34D399]">
                                <Receipt size={11} /> Invoice
                              </span>
                            )}
                          </td>
                          <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${inv.type === 'CREDIT_INVOICE' ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#172033] dark:text-[#CBD5E1]'}`}>
                            {inv.type === 'CREDIT_INVOICE' ? '+' : ''}<span className="text-[#F59E0B] font-black mr-0.5">{inv.currency}</span>{Math.abs(inv.totalAmount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => inv.id && handleDelete(inv.id, inv.storeName)}
                              disabled={deletingId === inv.id}
                              aria-label={`Admin delete receipt for ${inv.storeName}`}
                              className="px-3 py-2 min-h-[44px] text-xs font-semibold rounded-[10px] bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#F87171]/10 dark:text-[#F87171] hover:bg-[#DC2626] hover:text-white dark:hover:bg-[#DC2626] dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA] inline-flex items-center gap-1"
                            >
                              {deletingId === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default AdminBoard;
