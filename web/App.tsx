import React, { useState, useEffect } from 'react';
import { AppState, InvoiceData } from './types';
import { processInvoiceImage } from './services/invoiceService';
import { fetchInvoices, saveInvoiceToStorage, deleteInvoiceFromStorage } from './services/storageService';
import { requestNotificationPermission } from './services/notificationService';
import CameraCapture from './components/CameraCapture';
import ReceiptView from './components/ReceiptView';
import Dashboard from './components/Dashboard';
import Button from './components/Button';
import { Loader2, Search } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
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
    setState(AppState.PROCESSING);
    try {
      const data = await processInvoiceImage(base64Image);
      setInvoiceData(data);
      setState(AppState.VIEWING);
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "An error occurred");
      setState(AppState.ERROR);
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
    <div className="h-full w-full bg-slate-50 flex items-center justify-center overflow-hidden">
      
      {/* 1. DASHBOARD STATE (Formerly IDLE) */}
      {state === AppState.IDLE && (
        <Dashboard 
          invoices={invoices}
          isLoading={isLoadingInvoices}
          onScanClick={() => setState(AppState.SCANNING)}
          onUploadClick={handleFileUpload}
          onInvoiceClick={handleViewInvoice}
          AppLogo={AppLogo}
        />
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

      {/* 4. VIEWING STATE */}
      {state === AppState.VIEWING && invoiceData && (
        <div className="w-full max-w-lg h-full bg-slate-100 shadow-2xl">
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
      )}

      {/* 5. ERROR STATE */}
      {state === AppState.ERROR && (
        <div className="w-full max-w-lg h-full bg-white flex flex-col items-center justify-center p-8 shadow-2xl">
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