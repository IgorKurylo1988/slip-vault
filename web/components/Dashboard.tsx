import React, { useMemo, useState } from 'react';
import { InvoiceData } from '../types';
import InvoiceListItem from './InvoiceListItem';
import Button from './Button';
import { Upload, CreditCard, Receipt, List } from 'lucide-react';

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
  onLogout
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadClick({ target: { files: e.dataTransfer.files } });
    }
  };

  return (
    <div className="w-full h-full bg-[#F8FAFC] dark:bg-[#070B14] flex flex-col justify-between border-r border-[#DCE3EC] dark:border-[#334155]">
      
      {/* Top Sidebar Header */}
      <div className="p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="scale-90 origin-left"><AppLogo /></div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-[#172033] dark:text-[#F8FAFC] tracking-tight">Receipt Vault</h1>
            <p className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mt-0.5">Digitized Credit Vault</p>
          </div>
        </div>

        {/* Upload Action Drag & Drop Area */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`relative group rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
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
            className="mb-2 shadow-md min-h-[44px]"
          >
            Upload Receipt
          </Button>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
            Drag & drop receipt here or click to browse
          </p>
          <span className="inline-block mt-1 text-xs text-[#94A3B8] dark:text-[#94A3B8] bg-[#F1F5F9] dark:bg-[#1E293B] px-2.5 py-1 rounded-full font-medium">
            JPEG, PNG, PDF • Max 10MB
          </span>
        </div>

        {/* Navigation / Filter Tabs with 44px Touch Targets */}
        <div className="mt-6 space-y-2">
          <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-normal block mb-2 px-1">
            Filter View
          </label>
          <button 
            onClick={() => setFilter('ALL')}
            aria-label="Filter all receipts"
            className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] ${
              filter === 'ALL' 
                ? 'bg-[#2563EB] text-white shadow-sm' 
                : 'text-[#172033] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#111827]'
            }`}
          >
            <span className="flex items-center gap-2.5"><List size={16} /> All Receipts</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${filter === 'ALL' ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}>
              {stats.count}
            </span>
          </button>

          <button 
            onClick={() => setFilter('INVOICE')}
            aria-label="Filter invoices"
            className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] ${
              filter === 'INVOICE' 
                ? 'bg-[#2563EB] text-white shadow-sm' 
                : 'text-[#172033] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#111827]'
            }`}
          >
            <span className="flex items-center gap-2.5"><Receipt size={16} /> Invoices</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${filter === 'INVOICE' ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}>
              {invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT').length}
            </span>
          </button>

          <button 
            onClick={() => setFilter('CREDIT_INVOICE')}
            aria-label="Filter credit receipts"
            className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#60A5FA] ${
              filter === 'CREDIT_INVOICE' 
                ? 'bg-[#2563EB] text-white shadow-sm' 
                : 'text-[#172033] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#111827]'
            }`}
          >
            <span className="flex items-center gap-2.5"><CreditCard size={16} /> Credits</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${filter === 'CREDIT_INVOICE' ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'}`}>
              {stats.creditCount}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile-Only List Section */}
      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-3 md:hidden no-scrollbar">
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
        ) : invoices.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8] bg-white dark:bg-[#111827] rounded-2xl border border-[#DCE3EC] dark:border-[#334155]">
            No receipts uploaded yet.
          </div>
        ) : (
          invoices.map((inv) => (
            <InvoiceListItem key={inv.id} invoice={inv} onClick={() => onInvoiceClick(inv)} />
          ))
        )}
      </div>

      {/* Bottom Logout Option with 44px Touch Target */}
      <div className="p-4 border-t border-[#DCE3EC] dark:border-[#334155] bg-white dark:bg-[#111827] flex items-center justify-between shrink-0">
        <div className="flex flex-col truncate pr-3">
          <span className="text-xs font-semibold text-[#172033] dark:text-[#F8FAFC] truncate">
            {userName || userEmail.split('@')[0]}
          </span>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{userEmail}</span>
        </div>
        <button 
          onClick={onLogout}
          aria-label="Log out of account"
          className="min-h-[44px] min-w-[70px] px-4 py-2.5 text-xs font-semibold text-[#DC2626] dark:text-[#F87171] hover:bg-[#DC2626]/10 dark:hover:bg-[#F87171]/10 rounded-[10px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#60A5FA] shrink-0"
        >
          Logout
        </button>
      </div>

    </div>
  );
};

export default Dashboard;