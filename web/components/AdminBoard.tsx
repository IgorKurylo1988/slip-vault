import React, { useState, useEffect, useMemo } from 'react';
import { InvoiceData } from '../types';
import Button from './Button';
import DeleteConfirmModal from './DeleteConfirmModal';
import { Search, Trash2, ShieldAlert, ArrowLeft, Loader2, CreditCard, Receipt, FileText, RefreshCw, X, Download, Users, User } from 'lucide-react';

interface AdminBoardProps {
  onClose: () => void;
  onViewInvoice: (invoice: InvoiceData) => void;
}

interface AdminUser {
  id: string;
  email: string;
  role?: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  uploadedPicturesCount: number;
  totalSpend: number;
  totalCredits: number;
}

const getUserInitials = (fName?: string, lName?: string, email?: string): string => {
  const f = (fName || '').trim();
  const l = (lName || '').trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f[0].toUpperCase();
  if (l) return l[0].toUpperCase();
  if (email) return email.trim()[0].toUpperCase();
  return 'U';
};

const formatDate = (dateStr: string | number) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getApiUrl = (path: string) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base = isLocal ? 'http://localhost:8000' : 'https://api.slip-vault.com';
  return `${base}${path}`;
};

const AdminBoard: React.FC<AdminBoardProps> = ({ onClose, onViewInvoice }) => {
  const [activeTab, setActiveTab] = useState<'RECEIPTS' | 'USERS'>('RECEIPTS');
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteReceipt, setPendingDeleteReceipt] = useState<{ id: string; storeName: string; invoiceNumber: string } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [exportingUserId, setExportingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'INVOICE' | 'CREDIT_INVOICE'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || '';
      const headers = { 'Authorization': `Bearer ${token}` };

      const [invRes, usersRes] = await Promise.all([
        fetch(getApiUrl('/api/admin/invoices'), { headers }),
        fetch(getApiUrl('/api/admin/users'), { headers })
      ]);

      if (!invRes.ok) {
        const data = await invRes.json().catch(() => ({ detail: 'Failed to fetch admin invoices' }));
        throw new Error(data.detail || 'Admin access required.');
      }

      const invData = await invRes.json();
      setInvoices(invData);

      if (usersRes.ok) {
        const userData = await usersRes.json();
        setUsers(userData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleConfirmDeleteReceipt = async () => {
    if (!pendingDeleteReceipt) return;
    const { id } = pendingDeleteReceipt;
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
      setPendingDeleteReceipt(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportUserData = async (userId: string, email: string) => {
    setExportingUserId(userId);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/export`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to export user data.');
      }
      const data = await res.json();
      
      // Trigger JSON file download
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_${userId}_data_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingUserId(null);
    }
  };

  const handleDeleteUserData = async (userId: string, email: string) => {
    if (!confirm(`CRITICAL ADMIN ACTION: Are you sure you want to permanently DELETE ALL DATA & ACCOUNT for user "${email}" (${userId})? This action cannot be undone!`)) {
      return;
    }
    setDeletingUserId(userId);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to delete user data.');
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      setInvoices(prev => prev.filter((inv: any) => inv.userId !== userId));
      alert(`User ${email} and all associated receipt data have been permanently deleted.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'User deletion failed');
    } finally {
      setDeletingUserId(null);
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

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchQuery.toLowerCase();
      return (u.email || '').toLowerCase().includes(q) ||
             (u.id || '').toLowerCase().includes(q) ||
             (u.firstName || '').toLowerCase().includes(q) ||
             (u.lastName || '').toLowerCase().includes(q);
    });
  }, [users, searchQuery]);

  const stats = useMemo(() => {
    const totalCredits = invoices.filter(i => i.type === 'CREDIT_INVOICE').reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    const totalSpend = invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT').reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    return {
      totalDocs: invoices.length,
      usersCount: users.length || 1,
      totalCredits,
      totalSpend,
      currency: invoices[0]?.currency || '₪'
    };
  }, [invoices, users]);

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
            <p className="text-xs text-[#94A3B8]">System-wide Database & User Control Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAdminData} 
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
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase block">Registered Users</span>
                  <span className="text-2xl font-black text-[#172033] dark:text-[#F8FAFC]">{stats.usersCount}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase block">Uploaded Pictures</span>
                  <span className="text-2xl font-black text-[#172033] dark:text-[#F8FAFC]">{stats.totalDocs}</span>
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

            {/* Main Admin Section View Switcher */}
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={() => setActiveTab('RECEIPTS')}
                  className={`flex-1 md:flex-initial px-5 py-2.5 min-h-[44px] rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'RECEIPTS' ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}
                >
                  <FileText size={16} /> System Receipts ({invoices.length})
                </button>
                <button
                  onClick={() => setActiveTab('USERS')}
                  className={`flex-1 md:flex-initial px-5 py-2.5 min-h-[44px] rounded-[10px] text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'USERS' ? 'bg-[#2563EB] text-white shadow-sm' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}
                >
                  <Users size={16} /> Registered Users ({users.length})
                </button>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" size={18} />
                <input 
                  type="text"
                  placeholder={activeTab === 'RECEIPTS' ? "Search store, invoice #, user ID..." : "Search user email, name, user ID..."}
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
            </div>

            {/* TAB 1: SYSTEM RECEIPTS MANAGEMENT TABLE */}
            {activeTab === 'RECEIPTS' && (
              <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#DCE3EC] dark:border-[#334155] flex justify-between items-center bg-[#F8FAFC]/50 dark:bg-[#111827]">
                  <h2 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC]">System Receipts Registry</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setFilter('ALL')}
                      className={`px-3 py-1 text-xs rounded-full font-semibold ${filter === 'ALL' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B]'}`}
                    >
                      All ({invoices.length})
                    </button>
                    <button 
                      onClick={() => setFilter('INVOICE')}
                      className={`px-3 py-1 text-xs rounded-full font-semibold ${filter === 'INVOICE' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B]'}`}
                    >
                      Invoices ({invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT').length})
                    </button>
                    <button 
                      onClick={() => setFilter('CREDIT_INVOICE')}
                      className={`px-3 py-1 text-xs rounded-full font-semibold ${filter === 'CREDIT_INVOICE' ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B]'}`}
                    >
                      Credits ({invoices.filter(i => i.type === 'CREDIT_INVOICE').length})
                    </button>
                  </div>
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
                        <th className="px-6 py-3.5 text-center">Admin Action</th>
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
                                onClick={() => inv.id && setPendingDeleteReceipt({ id: inv.id, storeName: inv.storeName || 'Unknown Store', invoiceNumber: inv.invoiceNumber || inv.id })}
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
            )}

            {/* TAB 2: REGISTERED USERS MANAGEMENT TABLE */}
            {activeTab === 'USERS' && (
              <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#DCE3EC] dark:border-[#334155] flex justify-between items-center bg-[#F8FAFC]/50 dark:bg-[#111827]">
                  <h2 className="text-sm font-bold text-[#172033] dark:text-[#F8FAFC]">System Users & Per-User Upload Data</h2>
                  <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold px-3 py-1 rounded-full">
                    {filteredUsers.length} Users Enrolled
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#DCE3EC] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B]/40 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                        <th className="px-6 py-3.5">User Email / Profile</th>
                        <th className="px-6 py-3.5">User ID</th>
                        <th className="px-6 py-3.5 text-center">Role</th>
                        <th className="px-6 py-3.5 text-center">Uploaded Pictures</th>
                        <th className="px-6 py-3.5 text-right">Total Volume</th>
                        <th className="px-6 py-3.5 text-right">Total Credits</th>
                        <th className="px-6 py-3.5 text-center">Admin User Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3EC] dark:divide-[#334155]">
                      {loading ? (
                        [1, 2, 3].map(i => (
                          <tr key={i} className="animate-pulse">
                            <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-[#F1F5F9] dark:bg-[#1E293B] rounded"></div></td>
                          </tr>
                        ))
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                            No registered users found matching query.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors text-xs">
                            <td className="px-6 py-4 font-semibold text-[#172033] dark:text-[#F8FAFC]">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center font-black text-xs tracking-wider shrink-0 uppercase shadow-sm">
                                  {getUserInitials(u.firstName, u.lastName, u.email)}
                                </div>
                                <div>
                                  <div className="font-bold text-[#172033] dark:text-[#F8FAFC]">{u.email}</div>
                                  <div className="text-[11px] font-normal text-[#64748B] dark:text-[#94A3B8]">
                                    {u.firstName || u.lastName ? `${u.firstName} ${u.lastName}`.trim() : 'Registered User'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">
                              {u.id}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {u.role === 'ADMIN' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                                  <ShieldAlert size={11} /> Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]">
                                  User
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]">
                                <FileText size={12} /> {u.uploadedPicturesCount} Uploaded
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold whitespace-nowrap text-[#172033] dark:text-[#CBD5E1]">
                              <span className="text-[#F59E0B] font-black mr-0.5">₪</span>{u.totalSpend.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right font-bold whitespace-nowrap text-[#059669] dark:text-[#34D399]">
                              <span className="text-[#F59E0B] font-black mr-0.5">₪</span>{u.totalCredits.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                {/* Export Data Button */}
                                <button
                                  onClick={() => handleExportUserData(u.id, u.email)}
                                  disabled={exportingUserId === u.id}
                                  aria-label={`Export receipt data for user ${u.email}`}
                                  className="px-3 py-2 min-h-[44px] text-xs font-semibold rounded-[10px] bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#2563EB] dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA] inline-flex items-center gap-1.5"
                                  title="Export user data as JSON"
                                >
                                  {exportingUserId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                  Export Data
                                </button>

                                {/* Delete User & All Data Button */}
                                <button
                                  onClick={() => handleDeleteUserData(u.id, u.email)}
                                  disabled={deletingUserId === u.id}
                                  aria-label={`Delete user account and data for ${u.email}`}
                                  className="px-3 py-2 min-h-[44px] text-xs font-semibold rounded-[10px] bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#F87171]/10 dark:text-[#F87171] hover:bg-[#DC2626] hover:text-white dark:hover:bg-[#DC2626] dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA] inline-flex items-center gap-1.5"
                                  title="Delete user account and all receipts"
                                >
                                  {deletingUserId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  Wipe User Data
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Admin Delete Confirmation Modal */}
      {pendingDeleteReceipt && (
        <DeleteConfirmModal
          title="Admin Delete Receipt Confirmation"
          itemName={pendingDeleteReceipt.storeName}
          expectedInvoiceNumber={pendingDeleteReceipt.invoiceNumber}
          onConfirm={handleConfirmDeleteReceipt}
          onCancel={() => setPendingDeleteReceipt(null)}
          isDeleting={!!deletingId}
        />
      )}
    </div>
  );
};

export default AdminBoard;
