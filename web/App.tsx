import React, { useState, useEffect, useMemo } from 'react';
import { AppState, InvoiceData } from './types';
import { processInvoiceImage } from './services/invoiceService';
import { fetchInvoices, saveInvoiceToStorage, deleteInvoiceFromStorage } from './services/storageService';
import { requestNotificationPermission, pollInvoiceStatus } from './services/notificationService';
import CameraCapture from './components/CameraCapture';
import ReceiptView from './components/ReceiptView';
import Dashboard from './components/Dashboard';
import Button from './components/Button';
import { Loader2, Search, X, CreditCard, Receipt, FileText, Eye, Sun, Moon } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [activeTasks, setActiveTasks] = useState<{ id: string; name: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  // Lifted filters/search state
  const [filter, setFilter] = useState<'ALL' | 'INVOICE' | 'CREDIT_INVOICE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // User ID for multi-tenant path structure (stable for consistent testing across sessions)
  const [userId] = useState<string>("user_test_stable");

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  // Loading states
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load invoices on mount and request notification permissions
  useEffect(() => {
    requestNotificationPermission();
    
    const loadData = async () => {
      setIsLoadingInvoices(true);
      try {
        const data = await fetchInvoices();
        setInvoices(data);
      } catch (e) {
        console.error("Failed to load history");
      } finally {
        setIsLoadingInvoices(false);
      }
    };
    loadData();
  }, []);

  const handleCapture = async (base64Image: string) => {
    // Navigate back to IDLE so the user can continue using the dashboard
    setState(AppState.IDLE);
    
    // Create a temporary task ID to show progress until we get the actual ID from API
    const tempTaskId = `uploading-${Date.now()}`;
    setActiveTasks(prev => [...prev, { id: tempTaskId, name: "Uploading receipt..." }]);
    
    try {
      const pendingData = await processInvoiceImage(base64Image, userId);
      const invoiceId = pendingData.id;
      
      // Swap the temp ID for the actual invoice ID
      setActiveTasks(prev => prev.map(t => t.id === tempTaskId ? { id: invoiceId, name: "Processing..." } : t));
      
      // Poll status of the invoice ID in the background
      pollInvoiceStatus(
        invoiceId,
        (completedData) => {
          // Remove from active tasks
          setActiveTasks(prev => prev.filter(t => t.id !== invoiceId));
          // Prepend the new invoice to history list
          setInvoices(prev => [completedData, ...prev.filter(i => i.id !== completedData.id)]);
        },
        (errorReason) => {
          setActiveTasks(prev => prev.filter(t => t.id !== invoiceId));
          alert(`Receipt analysis failed: ${errorReason}`);
        }
      );
    } catch (error) {
      console.error(error);
      setActiveTasks(prev => prev.filter(t => t.id !== tempTaskId));
      alert(`Upload failed: ${error instanceof Error ? error.message : "An error occurred"}`);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1];
        handleCapture(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveInvoice = async (data: InvoiceData) => {
    setIsSaving(true);
    try {
      const saved = await saveInvoiceToStorage(data);
      // Optimistically update list or re-fetch
      setInvoices(prev => [saved, ...prev.filter(i => i.id !== saved.id)]); 
      setInvoiceData(null);
      setState(AppState.IDLE);
    } catch (e) {
      alert("Failed to save invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteInvoiceFromStorage(id);
      setInvoices(invoices.filter(i => i.id !== id));
      setInvoiceData(null);
      setState(AppState.IDLE);
    } catch (e) {
      alert("Failed to delete invoice");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewInvoice = (invoice: InvoiceData) => {
    setInvoiceData(invoice);
    setState(AppState.VIEWING);
  };

  const resetApp = () => {
    setInvoiceData(null);
    setErrorMsg("");
    setState(AppState.IDLE);
  };

  // Compute metrics/stats for dashboard cards
  const stats = useMemo(() => {
    const credits = invoices.filter(i => i.type === 'CREDIT_INVOICE');
    const totalCredits = credits.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const invoicesOnly = invoices.filter(i => i.type === 'INVOICE' || i.type === 'RECEIPT');
    const totalSpend = invoicesOnly.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const currency = invoices[0]?.currency || '₪';
    return { 
      count: invoices.length, 
      creditCount: credits.length, 
      creditTotal: totalCredits,
      invoiceCount: invoicesOnly.length,
      totalSpend,
      currency 
    };
  }, [invoices]);

  // Filtered invoices for the desktop center panel table
  const desktopFilteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesFilter = filter === 'ALL' || inv.type === filter;
      const matchesSearch = inv.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [invoices, filter, searchQuery]);

  // Shared Logo Component
  const AppLogo = () => (
    <div className="w-24 h-24 mb-6 relative rounded-[1.5rem] bg-gradient-to-tr from-emerald-500 to-green-400 shadow-[0_10px_30px_-5px_rgba(16,185,129,0.4)] flex items-center justify-center overflow-hidden border border-white/10 group shrink-0">
      {/* Background Cloud Effect */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-16">
         <div className="absolute top-0 left-2 w-12 h-12 bg-white/20 rounded-full blur-lg"></div>
         <svg viewBox="0 0 24 24" fill="currentColor" className="text-white/20 w-full h-full transform scale-150">
            <path d="M17.5,19c-3.037,0-5.5-2.463-5.5-5.5c0-1.4,0.52-2.686,1.385-3.664C12.802,8.73,12.232,8,11.5,8c-0.199,0-0.392,0.033-0.579,0.082C10.462,6.236,8.604,5,6.5,5C3.463,5,1,7.463,1,10.5c0,2.697,1.933,4.95,4.5,5.405V16.5c0,3.037,2.463,5.5,5.5,5.5c1.4,0,2.686-0.52,3.664-1.385C15.27,21.198,16.324,21.5,17.5,21.5c2.481,0,4.5-2.019,4.5-4.5S19.981,12.5,17.5,12.5c-0.199,0-0.392,0.033-0.579,0.082C16.462,11.236,14.604,10,12.5,10c-0.655,0-1.276,0.133-1.846,0.364C11.198,10.875,11.5,11.644,11.5,12.5c0,2.481-2.019,4.5-4.5,4.5c-0.655,0-1.276-0.133-1.846-0.364C5.698,17.161,6.564,17.5,7.5,17.5c1.4,0,2.686-0.52,3.664-1.385C11.77,17.198,12.824,17.5,14,17.5c2.697,0,4.95-1.933,5.405-4.5H19.5c1.103,0,2-0.897,2-2s-0.897-2-2-2S17.5,9.897,17.5,11V19z" />
         </svg>
      </div>
      {/* Central Invoice Document */}
      <div className="relative z-10 transform -rotate-6 bg-white p-1.5 rounded-lg shadow-lg w-12 h-14 flex flex-col gap-1 border-t border-white/50 border-b border-r border-slate-200">
        <div className="flex justify-between items-center mb-0.5">
           <div className="w-3 h-1 bg-emerald-500 rounded-full"></div>
           <div className="w-2 h-1 bg-slate-200 rounded-full"></div>
        </div>
        <div className="space-y-1 flex-1">
           <div className="w-5 h-0.5 bg-slate-200 rounded-full"></div>
           <div className="w-4 h-0.5 bg-slate-200 rounded-full"></div>
        </div>
        <div className="mt-auto w-full h-1 bg-blue-100 rounded-sm"></div>
      </div>
      {/* Search Lens */}
      <div className="absolute z-20 bottom-5 right-5 transform translate-x-1 translate-y-1">
         <Search size={28} strokeWidth={3} className="text-white drop-shadow-md" />
         <div className="absolute top-[4px] left-[4px] w-[16px] h-[16px] bg-sky-200/20 rounded-full"></div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full bg-slate-100 flex overflow-hidden dark:bg-slate-950">
      
      {/* Dashboard & Viewer Wrapper (active for IDLE and VIEWING states) */}
      {(state === AppState.IDLE || state === AppState.VIEWING) && (
        <div className="flex-1 flex h-full w-full overflow-hidden">
          {/* Left Panel: Dashboard / Sidebar on desktop */}
          <div className={`h-full w-full md:w-[350px] md:shrink-0 md:border-r md:border-slate-200 dark:border-slate-800 ${state === AppState.IDLE ? 'block' : 'hidden md:block'}`}>
            <Dashboard 
              invoices={invoices}
              activeTasks={activeTasks}
              isLoading={isLoadingInvoices}
              onScanClick={() => setState(AppState.SCANNING)}
              onUploadClick={handleFileUpload}
              onInvoiceClick={handleViewInvoice}
              AppLogo={AppLogo}
              filter={filter}
              setFilter={setFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          </div>

          {/* Right/Center Panel: Search Invoice and Receipt Table or Dashboard Metrics */}
          <div className="h-full flex-1 bg-slate-50 flex flex-col overflow-hidden dark:bg-slate-950">
            {/* Desktop Only Center Search Header */}
            <div className="hidden md:block w-full bg-white border-b border-slate-200 py-5 px-8 shadow-sm shrink-0 dark:bg-slate-900 dark:border-slate-800">
               <div className="max-w-4xl mx-auto flex items-center justify-between">
                 <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Workspace Dashboard</h2>
                 <div className="relative w-full max-w-md shadow-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                       type="text"
                       placeholder="Search stores, date, invoice #..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="w-full h-10 pl-11 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500"
                      >
                        <X size={16} />
                      </button>
                    )}
                 </div>
               </div>
            </div>

            {/* Main scrollable area */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {state === AppState.VIEWING && invoiceData ? (
                /* Selected Receipt detail container (large table on desktop) */
                <div className="w-full h-full md:max-w-3xl md:mx-auto md:py-6 md:px-4 md:flex md:flex-col animate-in fade-in duration-300">
                  <div className="w-full h-full md:shadow-2xl md:rounded-3xl md:overflow-hidden md:border md:border-slate-200/50 dark:md:border-slate-800 md:flex md:flex-col">
                    <ReceiptView 
                      data={invoiceData} 
                      onSave={handleSaveInvoice}
                      onDelete={handleDeleteInvoice}
                      onClose={resetApp}
                      isSaved={!!invoiceData.id}
                      isSaving={isSaving}
                      isDeleting={isDeleting}
                    />
                  </div>
                </div>
              ) : (
                /* Desktop Overview Dashboard with statistics cards and a table of matching receipts */
                <div className="w-full h-full md:flex md:flex-col">
                  {/* Mobile Empty State */}
                  <div className="md:hidden text-center p-8 max-w-sm mx-auto mt-20">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center mx-auto mb-4 text-emerald-500 dark:bg-slate-900">
                      <Search className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Receipt Selected</h3>
                    <p className="text-sm text-slate-400 mt-2 dark:text-slate-500">
                      Select an invoice or receipt from the list to view its detailed breakdown.
                    </p>
                  </div>

                  {/* Desktop Only Dashboard Layout */}
                  <div className="hidden md:flex flex-col flex-1 p-8 max-w-5xl mx-auto w-full">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-6 mb-8 mt-2">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                          <FileText size={22} />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Total Documents</span>
                          <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.count}</span>
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Receipt size={22} />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Total Spends</span>
                          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {stats.currency}{stats.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <CreditCard size={22} />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Credit Balance</span>
                          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                            {stats.currency}{stats.creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Receipt Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col dark:bg-slate-900">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide dark:text-slate-200">Receipts & Invoices</h3>
                        <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-350 font-bold px-2.5 py-1 rounded-full">
                          {desktopFilteredInvoices.length} Matching
                        </span>
                      </div>
                      
                      <div className="overflow-y-auto flex-1 no-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white z-10 border-b border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                            <tr>
                              <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Store</th>
                              <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Invoice #</th>
                              <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Type</th>
                              <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Amount</th>
                              <th className="px-6 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                            {isLoadingInvoices ? (
                              [1, 2, 3].map(i => (
                                <tr key={i} className="animate-pulse">
                                  <td colSpan={6} className="px-6 py-5"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded"></div></td>
                                </tr>
                              ))
                            ) : desktopFilteredInvoices.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">No receipts found matching search/filter criteria.</td>
                              </tr>
                            ) : (
                              desktopFilteredInvoices.map((inv) => (
                                <tr 
                                  key={inv.id} 
                                  onClick={() => handleViewInvoice(inv)}
                                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors group text-sm"
                                >
                                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{inv.storeName}</td>
                                  <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{inv.invoiceNumber || '-'}</td>
                                  <td className="px-6 py-4 text-slate-600 dark:text-slate-350">{inv.date}</td>
                                  <td className="px-6 py-4">
                                    {inv.type === 'CREDIT_INVOICE' ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50">
                                        <CreditCard size={11} /> Credit
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/50">
                                        <Receipt size={11} /> Invoice
                                      </span>
                                    )}
                                  </td>
                                  <td className={`px-6 py-4 text-right font-bold ${inv.type === 'CREDIT_INVOICE' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                    {inv.type === 'CREDIT_INVOICE' ? '-' : ''}{inv.currency}{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <button className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-50 text-slate-500 group-hover:bg-slate-800 group-hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-100 dark:group-hover:text-slate-900 transition-colors">
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. SCANNING STATE */}
      {state === AppState.SCANNING && (
        <CameraCapture 
          onCapture={handleCapture} 
          onCancel={() => setState(AppState.IDLE)} 
        />
      )}

      {/* 3. PROCESSING STATE */}
      {state === AppState.PROCESSING && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8">
          <div className="relative">
             <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-emerald-500 animate-spin"></div>
             <Loader2 className="w-10 h-10 text-emerald-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mt-8 mb-2">Analyzing...</h3>
          <p className="text-slate-500 text-center max-w-xs">
            Extracting details and checking for credit items.
          </p>
        </div>
      )}

      {/* 5. ERROR STATE */}
      {state === AppState.ERROR && (
        <div className="w-full max-w-lg h-full bg-white flex flex-col items-center justify-center p-8 shadow-2xl mx-auto">
           <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 border-2 border-red-100">
              <span className="text-4xl font-bold">!</span>
           </div>
           <h3 className="text-2xl font-bold text-slate-900 mb-2">Oops!</h3>
           <p className="text-slate-500 text-center mb-10 px-4 leading-relaxed">{errorMsg}</p>
           <Button onClick={resetApp} variant="primary" className="w-full max-w-xs">Try Again</Button>
        </div>
      )}
    </div>
  );
};

export default App;