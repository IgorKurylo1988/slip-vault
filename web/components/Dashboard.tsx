import React, { useMemo } from 'react';
import { InvoiceData } from '../types';
import InvoiceListItem from './InvoiceListItem';
import Button from './Button';
import { Scan, Upload, CreditCard, Receipt, List, Search as SearchIcon, X, Sun, Moon } from 'lucide-react';

type FilterType = 'ALL' | 'INVOICE' | 'CREDIT_INVOICE';

interface DashboardProps {
  invoices: InvoiceData[];
  isLoading: boolean;
  onScanClick: () => void;
  onUploadClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInvoiceClick: (invoice: InvoiceData) => void;
  AppLogo: React.FC;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices, 
  isLoading, 
  onScanClick, 
  onUploadClick, 
  onInvoiceClick,
  AppLogo,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  theme,
  toggleTheme
}) => {
  const stats = useMemo(() => {
    const credits = invoices.filter(i => i.type === 'CREDIT_INVOICE');
    const totalCredits = credits.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const invoicesOnly = invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT');
    const totalSpend = invoicesOnly.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const currency = invoices[0]?.currency || '₪';
    return { count: invoices.length, creditCount: credits.length, creditTotal: totalCredits, totalSpend, currency };
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
    <div className="w-full h-full bg-slate-50 flex flex-col md:max-w-none md:shadow-none relative dark:bg-slate-900">
      
      {/* Header Section */}
      <div className="bg-white px-6 pt-8 pb-4 rounded-b-[2.5rem] shadow-sm z-10 flex flex-col shrink-0 dark:bg-slate-900 dark:border-b dark:border-slate-800">
         <div className="flex items-center justify-between w-full mb-6">
            <div className="flex items-center gap-3">
              <div className="scale-75 origin-left"><AppLogo /></div>
              <div className="flex flex-col">
                <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none">Slip Vault</h1>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-1 dark:text-slate-550">Digital Receipt Vault</p>
              </div>
            </div>
         </div>
         
         {/* Mobile Metrics (Total Documents, Total Spends, Credit Balance) */}
         <div className="grid grid-cols-3 gap-2 mb-4 md:hidden border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl flex flex-col">
              <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">Documents</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{stats.count}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl flex flex-col">
              <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">Total Spend</span>
              <span className="text-sm font-black text-emerald-600 truncate">{stats.currency}{stats.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl flex flex-col">
              <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">Credit Bal</span>
              <span className="text-sm font-black text-blue-600 truncate">{stats.currency}{stats.creditTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
            </div>
         </div>

         {/* Search Bar (Mobile only) */}
         <div className="relative mb-4 md:hidden">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
               type="text"
               placeholder="Search store or invoice #..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full h-11 pl-10 pr-10 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none dark:bg-slate-800 dark:text-slate-100"
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
              className="h-11 text-sm md:hidden"
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
                className="h-11 w-full text-sm font-semibold dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-slate-700"
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
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
              filter === 'ALL' 
                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' 
                : 'bg-white text-slate-500 border border-slate-100 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/50'
            }`}
          >
            <List size={12} /> All
          </button>
          <button 
            onClick={() => setFilter('INVOICE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
              filter === 'INVOICE' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white text-slate-500 border border-slate-100 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/50'
            }`}
          >
            <Receipt size={12} /> Invoices
          </button>
          <button 
            onClick={() => setFilter('CREDIT_INVOICE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
              filter === 'CREDIT_INVOICE' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-slate-500 border border-slate-100 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/50'
            }`}
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
                 <div key={i} className="h-16 bg-white rounded-xl shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-750 animate-pulse animate-duration-1000"></div>
               ))}
             </div>
           ) : filteredInvoices.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-slate-400 mt-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-800/30">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                  <SearchIcon size={20} className="opacity-30" />
                </div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-350">No matches found</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Try a different filter or search term</p>
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
      <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-100 p-3 flex justify-between items-center z-10 px-6 dark:bg-slate-900/90 dark:border-slate-800">
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-tight">Encrypted Storage</span>
         </div>
         
         <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            </button>
            <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tight">{filteredInvoices.length} Items Listed</span>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;