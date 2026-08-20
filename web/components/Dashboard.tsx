import React, { useMemo, useState } from 'react';
import { InvoiceData } from '../types';
import InvoiceListItem from './InvoiceListItem';
import Button from './Button';
import { Upload, CreditCard, Receipt, List, Search, X } from 'lucide-react';

type FilterType = 'ALL' | 'INVOICE' | 'CREDIT_INVOICE';

interface DashboardProps {
  invoices: InvoiceData[];
  activeTasks: { id: string; name: string }[];
  isLoading: boolean;
  onUploadClick: (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }) => void;
  onInvoiceClick: (invoice: InvoiceData) => void;
  AppLogo: React.FC;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  userEmail: string;
  userName: string;
  onOpenAccountModal: () => void;
  onLogout: () => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices, 
  activeTasks,
  isLoading, 
  onUploadClick, 
  onInvoiceClick,
  AppLogo,
  filter,
  setFilter,
  userEmail,
  userName,
  onOpenAccountModal,
  onLogout,
  searchQuery = '',
  setSearchQuery
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const stats = useMemo(() => {
    const credits = invoices.filter(i => i.type === 'CREDIT_INVOICE');
    const totalCredits = credits.reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    const invoicesOnly = invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT');
    const totalSpend = invoicesOnly.reduce((acc, curr) => acc + Math.abs(curr.totalAmount || 0), 0);
    const currency = invoices[0]?.currency || '₪';
    return { count: invoices.length, creditCount: credits.length, creditTotal: totalCredits, totalSpend, currency };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter(inv => {
      if (filter === 'INVOICE' && (inv.type !== 'INVOICE' && inv.type !== 'RECEIPT')) return false;
      if (filter === 'CREDIT_INVOICE' && inv.type !== 'CREDIT_INVOICE') return false;
      if (q) {
        const sMatch = (inv.storeName || '').toLowerCase().includes(q);
        const iMatch = (inv.invoiceNumber || '').toLowerCase().includes(q);
        const dMatch = (inv.date || '').toLowerCase().includes(q);
        return sMatch || iMatch || dMatch;
      }
      return true;
    });
  }, [invoices, filter, searchQuery]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadClick({ target: { files: e.dataTransfer.files } });
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden bg-[#F8FAFC] dark:bg-[#070B14] border-r border-[#DCE3EC] dark:border-[#334155]">
      
      {/* Scrollable Main Section: Top Header, Upload, Filters, Mobile Stats & Receipts List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 no-scrollbar">
        
        {/* App Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="scale-90 origin-left shrink-0"><AppLogo /></div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg md:text-xl font-black text-[#172033] dark:text-[#F8FAFC] tracking-tight truncate">Receipt Vault</h1>
            <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] truncate">Digitized Credit Vault</p>
          </div>
        </div>

        {/* Upload Action Drag & Drop Area */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`relative group rounded-2xl border-2 border-dashed p-3 md:p-4 text-center transition-all ${
            isDragOver 
              ? 'border-[#2563EB] bg-[#2563EB]/10 dark:bg-[#2563EB]/20 scale-[1.01]' 
              : 'border-[#DCE3EC] dark:border-[#334155] bg-white dark:bg-[#111827] hover:border-[#2563EB] dark:hover:border-[#2563EB]'
          }`}
        >
          <input
            type="file"
            accept="image/*,.pdf"
            aria-label="Upload Receipt"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={onUploadClick}
          />
          <Button 
            fullWidth 
            variant="primary"
            icon={<Upload size={18} aria-hidden="true" />}
            className="mb-1.5 shadow-md min-h-[44px]"
          >
            Upload Receipt
          </Button>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium hidden sm:block">
            Drag & drop receipt here or click to browse
          </p>
          <span className="inline-block mt-0.5 text-[10px] text-[#94A3B8] dark:text-[#94A3B8] bg-[#F1F5F9] dark:bg-[#1E293B] px-2 py-0.5 rounded-full font-medium">
            JPEG, PNG, PDF • Max 10MB
          </span>
        </div>

        {/* Navigation / Filter Tabs with 44px Touch Targets */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-normal block px-1">
            Filter View
          </label>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-1.5">
            <button 
              onClick={() => setFilter('ALL')}
              aria-label="Filter all receipts"
              className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] ${
                filter === 'ALL' 
                  ? 'bg-[#2563EB] text-white shadow-sm' 
                  : 'text-[#172033] dark:text-[#CBD5E1] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
              }`}
            >
              <span className="flex items-center gap-2 truncate"><List size={16} /><span className="truncate">All</span></span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${filter === 'ALL' ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}>
                {stats.count}
              </span>
            </button>

            <button 
              onClick={() => setFilter('INVOICE')}
              aria-label="Filter invoices"
              className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] ${
                filter === 'INVOICE' 
                  ? 'bg-[#2563EB] text-white shadow-sm' 
                  : 'text-[#172033] dark:text-[#CBD5E1] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
              }`}
            >
              <span className="flex items-center gap-2 truncate"><Receipt size={16} /><span className="truncate">Invoices</span></span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${filter === 'INVOICE' ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}>
                {invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT').length}
              </span>
            </button>

            <button 
              onClick={() => setFilter('CREDIT_INVOICE')}
              aria-label="Filter credit receipts"
              className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] ${
                filter === 'CREDIT_INVOICE' 
                  ? 'bg-[#2563EB] text-white shadow-sm' 
                  : 'text-[#172033] dark:text-[#CBD5E1] bg-white dark:bg-[#111827] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
              }`}
            >
              <span className="flex items-center gap-2 truncate"><CreditCard size={16} /><span className="truncate">Credits</span></span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${filter === 'CREDIT_INVOICE' ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}>
                {stats.creditCount}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Summary Cards: Total Docs, Total Spent, Total Credits */}
        <div className="grid grid-cols-3 gap-2 md:hidden pt-1">
          <div className="bg-white dark:bg-[#111827] p-2.5 rounded-xl border border-[#DCE3EC] dark:border-[#334155] text-center shadow-sm">
            <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase block">Total Docs</span>
            <span className="text-sm font-black text-[#172033] dark:text-[#F8FAFC]">{stats.count}</span>
          </div>
          <div className="bg-white dark:bg-[#111827] p-2.5 rounded-xl border border-[#DCE3EC] dark:border-[#334155] text-center shadow-sm">
            <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase block">Total Spent</span>
            <span className="text-xs font-black text-[#172033] dark:text-[#F8FAFC] truncate block">
              <span className="text-[#F59E0B] font-extrabold mr-0.5">{stats.currency}</span>{stats.totalSpend.toFixed(0)}
            </span>
          </div>
          <div className="bg-white dark:bg-[#111827] p-2.5 rounded-xl border border-[#DCE3EC] dark:border-[#334155] text-center shadow-sm">
            <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase block font-sans">Credits</span>
            <span className="text-xs font-black text-[#059669] dark:text-[#34D399] truncate block">
              <span className="text-[#F59E0B] font-extrabold mr-0.5">{stats.currency}</span>{stats.creditTotal.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {setSearchQuery && (
          <div className="relative w-full md:hidden">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" size={16} />
            <input 
              type="text"
              placeholder="Search stores, date, invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-white dark:bg-[#111827] border border-[#DCE3EC] dark:border-[#334155] rounded-[10px] text-xs text-[#172033] dark:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Mobile-Only Receipt Cards List */}
        <div className="space-y-3 md:hidden">
          {activeTasks && activeTasks.map(task => (
            <div key={task.id} className="p-3 bg-[#059669]/10 border border-[#059669]/20 rounded-2xl flex items-center justify-between animate-pulse">
              <span className="text-xs font-semibold text-[#172033] dark:text-[#F8FAFC]">Analyzing Receipt...</span>
              <span className="text-xs bg-[#059669] text-white px-2.5 py-1 rounded-full font-bold">Processing</span>
            </div>
          ))}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white dark:bg-[#111827] rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8] bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE3EC] dark:border-[#334155]">
              {invoices.length === 0 ? "No receipts uploaded yet." : "No matching receipts found."}
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <InvoiceListItem key={inv.id} invoice={inv} onClick={() => onInvoiceClick(inv)} />
            ))
          )}
        </div>
      </div>

      {/* Fixed Bottom User Profile Bar with Mobile Safe Area */}
      <div className="p-3.5 pb-safe border-t border-[#DCE3EC] dark:border-[#334155] bg-white dark:bg-[#111827] flex items-center justify-between shrink-0 z-20">
        <button 
          onClick={onOpenAccountModal}
          className="flex items-center gap-2.5 truncate pr-2 text-left focus:outline-none"
          title="Open Account Settings"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center font-black text-xs tracking-wider shrink-0 uppercase shadow-sm">
            {(() => {
              const activeEmail = userEmail || localStorage.getItem('userEmail') || '';
              const nameParts = (userName || '').trim().split(/\s+/);
              if (nameParts.length >= 2 && nameParts[0] && nameParts[1]) {
                return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
              }
              if (userName && userName.trim()) {
                return userName.trim()[0].toUpperCase();
              }
              return (activeEmail || 'U').trim()[0].toUpperCase();
            })()}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-[#172033] dark:text-[#F8FAFC] truncate">
              {userName || (userEmail ? userEmail.split('@')[0] : (localStorage.getItem('userEmail') ? (localStorage.getItem('userEmail') || '').split('@')[0] : 'User Account'))}
            </span>
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
              {userEmail || localStorage.getItem('userEmail') || 'Account Active'}
            </span>
          </div>
        </button>
        <button 
          onClick={onLogout}
          aria-label="Log out of account"
          className="min-h-[44px] min-w-[70px] px-3 py-2 text-xs font-semibold text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/10 dark:hover:bg-[#F87171]/10 rounded-[10px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA] shrink-0"
        >
          Logout
        </button>
      </div>

    </div>
  );
};

export default Dashboard;