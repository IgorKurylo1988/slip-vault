import React, { useState, useRef } from 'react';
import { Share2, CheckCircle, MapPin, Undo2, Eye, X, Trash2, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { InvoiceData } from '../types';
import Button from './Button';
import Barcode from './Barcode';
import html2canvas from 'html2canvas';

interface ReceiptViewProps {
  data: InvoiceData;
  onSave?: (data: InvoiceData) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
}

const ReceiptView: React.FC<ReceiptViewProps> = ({ 
  data, 
  onSave, 
  onDelete, 
  onClose, 
  isSaved = false,
  isSaving = false,
  isDeleting = false
}) => {
  const [showImage, setShowImage] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const isCredit = data.type === 'CREDIT_INVOICE';
  
  // Theme logic based on the Icon colors
  const headerBgClass = isCredit 
    ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
    : 'bg-gradient-to-br from-emerald-400 to-teal-600';
    
  const iconBgClass = isCredit 
    ? 'bg-blue-50 text-blue-600' 
    : 'bg-emerald-50 text-emerald-600';
    
  const totalTextClass = isCredit 
    ? 'text-blue-600' 
    : 'text-emerald-600';
    
  const badgeClass = isCredit
    ? 'bg-blue-100 text-blue-700'
    : 'bg-emerald-100 text-emerald-700';

  const handleImageShare = async () => {
    if (!receiptRef.current) return;
    setIsSharingImage(true);

    try {
      // Capture the element as a canvas
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, // High resolution
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      // Convert to blob
      const blob = await new Promise<Blob | null>(resolve => 
        canvas.toBlob(resolve, 'image/png', 1.0)
      );

      if (!blob) throw new Error('Failed to generate image');

      const file = new File([blob], `invoice-${data.invoiceNumber || 'scan'}.png`, { type: 'image/png' });
      const typeLabel = isCredit ? 'CREDIT INVOICE' : 'Invoice';

      // Use Native Share Sheet
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Digitized ${typeLabel}`,
          text: `Here is the digitized invoice from ${data.storeName}.`,
          files: [file]
        });
      } else {
        // Fallback for desktop: Download the image directly to the phone/PC
        const link = document.createElement('a');
        link.download = `invoice-${data.invoiceNumber || 'scan'}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (err) {
      console.error("Sharing failed", err);
      alert("Could not export image. Try taking a screenshot manually.");
    } finally {
      setIsSharingImage(false);
    }
  };

  const handleDelete = () => {
    if (data.id && onDelete && confirm("Are you sure you want to delete this invoice?")) {
      onDelete(data.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden relative">
      <div className={`absolute top-0 left-0 w-full h-56 ${headerBgClass} rounded-b-[3rem] z-0 transition-all duration-300 shadow-lg`} />
      
      <div className="relative z-10 flex-1 overflow-y-auto pt-6 px-4 pb-40 no-scrollbar">
        {/* Navbar */}
        <div className="flex justify-between items-center mb-6 px-2 text-white">
            <button 
              onClick={onClose} 
              className="p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            
            <h2 className="text-lg font-bold flex items-center gap-2 drop-shadow-md text-center">
              {isCredit && <Undo2 size={18} className="text-white" />}
              {isCredit ? 'Credit Invoice' : 'Digitized Invoice'}
            </h2>
            
            <div className="flex gap-2">
              {data.scannedImage && (
                <button 
                  onClick={() => setShowImage(true)}
                  className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors shadow-sm"
                  title="View Processed Scan"
                >
                  <Eye size={20} />
                </button>
              )}
              {isSaved && (
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 bg-red-500/20 backdrop-blur-md rounded-full hover:bg-red-500/40 transition-colors shadow-sm text-red-100 disabled:opacity-50"
                  title="Delete"
                >
                  {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                </button>
              )}
            </div>
        </div>

        {/* Receipt Card - Wrapped in a ref for screenshotting */}
        <div ref={receiptRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden mb-8 animate-[slideUp_0.4s_ease-out] mx-1 relative">
            {/* Header Section */}
            <div className="p-6 text-center border-b border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm ${iconBgClass}`}>
                   {isCredit ? '💳' : '🛍️'}
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{data.storeName || "Unknown Store"}</h1>
                {data.storeAddress && (
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-slate-400 mt-1">
                    <MapPin size={12} />
                    <span className="truncate max-w-[200px]">{data.storeAddress}</span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-3 mt-3 text-xs font-medium text-gray-400 dark:text-slate-500">
                  <span>{data.date || "Date Unknown"}</span>
                  {data.time && <span>• {data.time}</span>}
                </div>
                
                {isCredit && (
                  <div className={`mt-3 inline-block px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${badgeClass}`}>
                    Return / Credit
                  </div>
                )}
            </div>

            {/* Items List */}
            <div className="p-6 bg-white dark:bg-slate-900 min-h-[100px]">
                {/* Mobile View List */}
                <div className="md:hidden">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-4 uppercase tracking-wider">
                      <span>Item Description</span>
                      <span>Amount</span>
                    </div>
                    <div className="space-y-5">
                        {data.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-sm group">
                                <div className="flex-1 pr-4">
                                    <span className="text-gray-900 dark:text-slate-100 font-semibold block leading-snug">{item.name}</span>
                                    <div className="flex flex-wrap items-center gap-2 text-gray-400 dark:text-slate-500 text-xs mt-1">
                                      {item.sku && (
                                        <span className="font-mono bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:border-slate-700/50 px-1.5 py-0.5 rounded text-[10px] tracking-tight text-slate-500 dark:text-slate-400">
                                          #{item.sku}
                                        </span>
                                      )}
                                      <span>x{item.quantity}</span>
                                    </div>
                                </div>
                                <span className="text-gray-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                                    {data.currency}{item.price.toFixed(2)}
                                </span>
                            </div>
                        ))}
                        {data.items.length === 0 && (
                            <p className="text-gray-400 dark:text-slate-500 text-center text-sm italic py-4">No item details detected.</p>
                        )}
                    </div>
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Item Description</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">SKU</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Qty</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Price</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                      {data.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-sm">
                          <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-100">{item.name}</td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{item.sku || '-'}</td>
                          <td className="px-4 py-3.5 text-center text-slate-600 dark:text-slate-350">{item.quantity}</td>
                          <td className="px-4 py-3.5 text-right text-slate-600 dark:text-slate-350">{data.currency}{item.price.toFixed(2)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-100">{data.currency}{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                      {data.items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 italic">No item details detected.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {data.subtotal && (
                      <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-slate-400 text-sm">Subtotal</span>
                          <span className="text-gray-900 dark:text-slate-200 font-medium">{data.currency}{data.subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {data.tax && (
                      <div className="flex justify-between items-center">
                          <span className="text-gray-500 dark:text-slate-400 text-sm">VAT / Tax</span>
                          <span className="text-gray-900 dark:text-slate-200 font-medium">{data.currency}{data.tax.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-850 mt-4">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {isCredit ? 'Refund Amount' : 'Total'}
                        </span>
                        <span className={`text-3xl font-bold ${totalTextClass}`}>
                          {data.currency}{Math.abs(data.totalAmount).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Barcode Section */}
            <div className="bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center border-t border-slate-100 dark:border-slate-850">
                <Barcode value={data.invoiceNumber || "INV-MISSING"} />
                <div className="flex items-center gap-2 mt-4 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                    <CheckCircle size={12} />
                    Verified by Gemini AI
                </div>
            </div>

            {/* Jagged Edge Effect */}
            <div className="jagged-edge-bottom mt-[-1px] relative z-10 from-slate-50 to-slate-50 dark:from-slate-950 dark:to-slate-950"></div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-4 pb-6 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] flex flex-col gap-3">
        {isSaved ? (
          <div className="flex gap-3">
            <Button onClick={onClose} variant="secondary" className="px-4 min-w-[3rem]">
              <ArrowLeft size={20} />
            </Button>
            <Button 
              onClick={handleImageShare} 
              variant="primary" 
              className="flex-1 shadow-emerald-200/50" 
              icon={isSharingImage ? <Loader2 className="animate-spin" /> : <Share2 size={20} />}
              disabled={isSharingImage}
            >
              {isSharingImage ? 'Processing...' : 'Export or Share Image'}
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
             <Button onClick={onClose} variant="danger" className="flex-1">
               Discard
             </Button>
             <Button 
               onClick={() => onSave && onSave(data)} 
               variant="primary" 
               className="flex-[2] shadow-emerald-200/50"
               icon={isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
               disabled={isSaving}
             >
               {isSaving ? 'Saving...' : 'Save Digitized Invoice'}
             </Button>
          </div>
        )}
      </div>

      {/* Processed Image Overlay Modal */}
      {showImage && data.scannedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-200">
           <div className="flex justify-between items-center mb-4">
             <span className="text-white/80 font-medium text-sm pl-2">Original Analyzed Scan</span>
             <button 
               onClick={() => setShowImage(false)} 
               className="text-white p-2 bg-white/10 rounded-full hover:bg-white/20"
             >
               <X size={24} />
             </button>
           </div>
           <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-900 rounded-lg border border-gray-800 relative">
             <img 
               src={
                 data.scannedImage.startsWith('data:') 
                   ? data.scannedImage 
                   : data.scannedImage.startsWith('http')
                     ? data.scannedImage.includes('storage.googleapis.com/slip-vault-receipts/')
                       ? `https://assets.slip-vault.com/${data.scannedImage.split('storage.googleapis.com/slip-vault-receipts/')[1]}?token=${localStorage.getItem('token') || ''}`
                       : `${data.scannedImage}?token=${localStorage.getItem('token') || ''}`
                     : `data:image/jpeg;base64,${data.scannedImage}`
               } 
               alt="Processed Scan" 
               className="max-w-full max-h-full object-contain"
             />
           </div>
           <p className="text-center text-white/50 text-xs mt-4 mb-2">
             High-contrast B&W processing optimized for AI extraction.
           </p>
        </div>
      )}
    </div>
  );
};

export default ReceiptView;