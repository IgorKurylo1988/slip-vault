import React, { useState, useMemo } from 'react';
import { InvoiceData } from '../types';
import InvoiceListItem from './InvoiceListItem';
import Button from './Button';
import { Scan, Upload, CreditCard, Receipt, List, Search as SearchIcon, X } from 'lucide-react';

interface DashboardProps {
  invoices: InvoiceData[];
  isLoading: boolean;
  onScanClick: () => void;
  onUploadClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInvoiceClick: (invoice: InvoiceData) => void;
  AppLogo: React.FC;
}

type FilterType = 'ALL' | 'INVOICE' | 'CREDIT_INVOICE';

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices, 
  isLoading, 
  onScanClick, 
  onUploadClick, 
  onInvoiceClick,
  AppLogo
}) => {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    const credits = invoices.filter(i => i.type === 'CREDIT_INVOICE');
    const totalCredits = credits.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const currency = credits[0]?.currency || '₪';
    return { count: invoices.length, creditCount: credits.length, creditTotal: totalCredits, currency };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesFilter = filter === 'ALL' || inv.type === filter;
      const matchesSearch = inv.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [invoices, filter, searchQuery]);

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col max-w-lg mx-auto shadow-2xl relative">
      
      {/* Header Section */}
      <div className="bg-white px-6 pt-8 pb-4 rounded-b-[2.5rem] shadow-sm z-10 flex flex-col shrink-0">
         <div className="flex items-center justify-between w-full mb-6">
            <div className="flex items-center gap-3">
              <div className="scale-75 origin-left"><AppLogo /></div>
              <div className="flex flex-col">
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">Slip Vault</h1>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-1">Digital Receipt Vault</p>
              </div>
            </div>
            
            <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-lg shadow-blue-200 flex flex-col items-end">
               <span className="text-[9px] uppercase font-bold opacity-80 leading-none">Credit Balance</span>
               <div className="text-lg font-black leading-tight">
                 {stats.currency}{stats.creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </div>
            </div>
         </div>

         {/* Search Bar */}
         <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search store or invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-10 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
         </div>

         <div className="flex gap-3 w-full">
            <Button 
              onClick={onScanClick} 
              fullWidth 
              variant="primary"
              icon={<Scan size={18} />}
              className="h-11 text-sm"
            >
              Scan New
            </Button>
            <div className="relative group flex-1">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={onUploadClick}
              />
              <Button 
                fullWidth 
                variant="secondary"
                icon={<Upload size={18} />}
                className="h-11 w-full text-sm"
              >
                Upload
              </Button>
            </div>
         </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-4 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setFilter('ALL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${filter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-100 shadow-sm'}`}
          >
            <List size={12} /> All
          </button>
          <button 
            onClick={() => setFilter('INVOICE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${filter === 'INVOICE' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 border border-slate-100 shadow-sm'}`}
          >
            <Receipt size={12} /> Invoices
          </button>
          <button 
            onClick={() => setFilter('CREDIT_INVOICE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${filter === 'CREDIT_INVOICE' ? 'bg-blue-500 text-white' : 'bg-white text-slate-500 border border-slate-100 shadow-sm'}`}
          >
            <CreditCard size={12} /> Credits
          </button>
      </div>

      {/* List Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-3 no-scrollbar relative">
           {isLoading ? (
             <div className="space-y-3 mt-1">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-16 bg-white rounded-xl shadow-sm border border-slate-100 animate-pulse"></div>
               ))}
             </div>
           ) : filteredInvoices.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-slate-400 mt-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <SearchIcon size={20} className="opacity-30" />
                </div>
                <p className="text-sm font-bold text-slate-500">No matches found</p>
                <p className="text-[11px] text-slate-400 mt-1">Try a different filter or search term</p>
             </div>
           ) : (
             filteredInvoices.map((inv) => (
               <InvoiceListItem 
                 key={inv.id} 
                 invoice={inv} 
                 onClick={() => onInvoiceClick(inv)} 
               />
             ))
           )}
        </div>
      </div>
      
      {/* Bottom Status Bar */}
      <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-100 p-4 flex justify-between items-center z-10 px-6">
         <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Encrypted Storage</span>
         </div>
         <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight">{filteredInvoices.length} Items Listed</span>
      </div>
    </div>
  );
};

export default Dashboard;