import React, { useState, useRef } from 'react';
import { Share2, CheckCircle, MapPin, Undo2, Eye, X, Trash2, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { InvoiceData } from '../types';
import Button from './Button';
import Barcode from './Barcode';
import DeleteConfirmModal from './DeleteConfirmModal';
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const isCredit = data.type === 'CREDIT_INVOICE';
  
  // Theme logic based on the Icon colors
  const headerBgClass = isCredit 
    ? 'bg-gradient-to-br from-[#4F46E5] to-[#2563EB]' 
    : 'bg-gradient-to-br from-[#2563EB] to-[#4F46E5]';
    
  const iconBgClass = isCredit 
    ? 'bg-indigo-50 text-[#4F46E5]' 
    : 'bg-blue-50 text-[#2563EB]';
    
  const totalTextClass = isCredit 
    ? 'text-[#059669] dark:text-[#34D399]' 
    : 'text-[#172033] dark:text-[#F8FAFC]';
    
  const badgeClass = isCredit
    ? 'bg-indigo-100 text-[#4F46E5]'
    : 'bg-blue-100 text-[#2563EB]';

  const handleImageShare = async () => {
    if (!receiptRef.current) return;
    setIsSharingImage(true);

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const blob = await new Promise<Blob | null>(resolve => 
        canvas.toBlob(resolve, 'image/png', 1.0)
      );

      if (!blob) throw new Error('Failed to generate image');

      const file = new File([blob], `invoice-${data.invoiceNumber || 'scan'}.png`, { type: 'image/png' });
      const typeLabel = isCredit ? 'CREDIT INVOICE' : 'Invoice';

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Digitized ${typeLabel}`,
          text: `Here is the digitized invoice from ${data.storeName}.`,
          files: [file]
        });
      } else {
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

  const handleDeleteConfirm = () => {
    if (data.id && onDelete) {
      onDelete(data.id);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#070B14] overflow-hidden relative">
      <div className={`absolute top-0 left-0 w-full h-56 ${headerBgClass} rounded-b-[3rem] z-0 transition-all duration-300 shadow-lg`} />
      
      <div className="relative z-10 flex-1 overflow-y-auto pt-6 px-4 pb-40 no-scrollbar">
        {/* Navbar */}
        <div className="flex justify-between items-center mb-6 px-2 text-white">
            <button 
              onClick={onClose} 
              aria-label="Close receipt details"
              title="Close receipt details"
              className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            
            <h2 className="text-base font-bold flex items-center gap-2 drop-shadow-md text-center">
              {isCredit && <Undo2 size={18} className="text-white" />}
              {isCredit ? 'Credit Invoice' : 'Digitized Invoice'}
            </h2>
            
            <div className="flex gap-2">
              {data.scannedImage && (
                <button 
                  onClick={() => setShowImage(true)}
                  aria-label="View original processed scan"
                  className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                  title="View Processed Scan"
                >
                  <Eye size={20} aria-hidden="true" />
                </button>
              )}
              {isSaved && (
                <button 
                  onClick={() => setShowDeleteModal(true)}
                  disabled={isDeleting}
                  aria-label="Delete receipt"
                  className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] bg-red-500/20 backdrop-blur-md rounded-full hover:bg-red-500/40 transition-colors shadow-sm text-red-100 disabled:opacity-50 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
                  title="Delete"
                >
                  {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} aria-hidden="true" />}
                </button>
              )}
            </div>
        </div>

        {/* Receipt Card - Responsive mobile framing without heavy shadows/border margins on small screens */}
        <div ref={receiptRef} className="bg-white dark:bg-[#111827] rounded-2xl md:shadow-xl shadow-sm border border-[#DCE3EC] dark:border-[#334155] overflow-hidden mb-8 animate-[slideUp_0.4s_ease-out] relative">
            {/* Header Section */}
            <div className="p-6 text-center border-b border-dashed border-[#DCE3EC] dark:border-[#334155] bg-white dark:bg-[#111827]">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm ${iconBgClass}`}>
                   {isCredit ? '💳' : '🛍️'}
                </div>
                <h1 className="text-xl font-bold text-[#172033] dark:text-[#F8FAFC] leading-tight break-words">{data.storeName || "Unknown Store"}</h1>
                {data.storeAddress && (
                  <div className="flex items-center justify-center gap-1 text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                    <MapPin size={12} aria-hidden="true" />
                    <span className="truncate max-w-[240px]">{data.storeAddress}</span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-3 mt-3 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
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
            <div className="p-6 bg-white dark:bg-[#111827] min-h-[100px]">
                {/* Mobile View List */}
                <div className="md:hidden">
                    <div className="flex justify-between text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-4 uppercase tracking-normal">
                      <span>Item Description</span>
                      <span>Amount</span>
                    </div>
                    <div className="space-y-4">
                        {data.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-xs border-b border-slate-100 dark:border-[#1E293B] pb-3 last:border-0">
                                <div className="flex-1 pr-4">
                                    <span className="text-[#172033] dark:text-[#F8FAFC] font-semibold block leading-snug break-words">{item.name}</span>
                                    <div className="flex flex-wrap items-center gap-2 text-[#64748B] dark:text-[#94A3B8] text-xs mt-1">
                                      {item.sku && (
                                        <span className="font-mono bg-[#F1F5F9] border border-[#DCE3EC] dark:bg-[#1E293B] dark:border-[#334155] px-1.5 py-0.5 rounded text-xs text-[#64748B] dark:text-[#94A3B8]">
                                          #{item.sku}
                                        </span>
                                      )}
                                      <span>x{item.quantity}</span>
                                    </div>
                                </div>
                                <span className="text-[#172033] dark:text-[#CBD5E1] font-semibold whitespace-nowrap">
                                    {data.currency}{item.price.toFixed(2)}
                                </span>
                            </div>
                        ))}
                        {data.items.length === 0 && (
                            <p className="text-[#64748B] dark:text-[#94A3B8] text-center text-xs italic py-4">No item details detected.</p>
                        )}
                    </div>
                </div>

                {/* Desktop View Table */}
                <div className="hidden md:block overflow-hidden rounded-xl border border-[#DCE3EC] dark:border-[#334155] shadow-sm bg-white dark:bg-[#111827]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#DCE3EC] dark:bg-[#1E293B] dark:border-[#334155]">
                        <th className="px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase">Item Description</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase">SKU</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase text-center">Qty</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase text-right">Price</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3EC] dark:divide-[#334155]">
                      {data.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors text-xs">
                          <td className="px-4 py-3.5 font-semibold text-[#172033] dark:text-[#F8FAFC]">{item.name}</td>
                          <td className="px-4 py-3.5 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">{item.sku || '-'}</td>
                          <td className="px-4 py-3.5 text-center text-[#172033] dark:text-[#CBD5E1]">{item.quantity}</td>
                          <td className="px-4 py-3.5 text-right text-[#172033] dark:text-[#CBD5E1]">{data.currency}{item.price.toFixed(2)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#172033] dark:text-[#F8FAFC]">{data.currency}{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                      {data.items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] italic">No item details detected.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

            {/* Totals */}
            <div className="mt-8 pt-4 border-t border-[#DCE3EC] dark:border-[#334155] space-y-2">
                {data.subtotal && (
                  <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Subtotal</span>
                      <span className="text-[#172033] dark:text-[#CBD5E1] font-semibold">
                        <span className="text-[#F59E0B] font-extrabold mr-0.5">{data.currency}</span>{data.subtotal.toFixed(2)}
                      </span>
                  </div>
                )}
                {data.tax && (
                  <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">VAT / Tax</span>
                      <span className="text-[#172033] dark:text-[#CBD5E1] font-semibold">
                        <span className="text-[#F59E0B] font-extrabold mr-0.5">{data.currency}</span>{data.tax.toFixed(2)}
                      </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-4 border-t-2 border-dashed border-[#DCE3EC] dark:border-[#334155] mt-4">
                    <span className="text-base font-bold text-[#2563EB] dark:text-[#F8FAFC]">
                      {isCredit ? 'Refund Amount' : 'Total'}
                    </span>
                    <span className={`text-2xl font-bold ${totalTextClass}`}>
                      {isCredit ? '+' : ''}<span className="text-[#F59E0B] font-black mr-0.5">{data.currency}</span>{Math.abs(data.totalAmount).toFixed(2)}
                    </span>
                </div>
            </div>
            </div>

            {/* Barcode Section */}
            <div className="bg-[#F8FAFC] dark:bg-[#070B14] p-6 flex flex-col items-center border-t border-[#DCE3EC] dark:border-[#334155]">
                <Barcode value={data.invoiceNumber || "INV-MISSING"} />
                <div className="flex items-center gap-2 mt-4 text-[#059669] dark:text-[#34D399] text-xs font-semibold uppercase bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                    <CheckCircle size={12} />
                    Verified Digitized Receipt
                </div>
            </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-[#111827] border-t border-[#DCE3EC] dark:border-[#334155] p-4 z-20 flex flex-col gap-3">
        {isSaved ? (
          <div className="flex gap-3">
            <Button onClick={onClose} variant="secondary" className="min-h-[44px] min-w-[44px] px-4" aria-label="Back to receipts">
              <ArrowLeft size={20} aria-hidden="true" />
            </Button>
            <Button 
              onClick={handleImageShare} 
              variant="primary" 
              className="flex-1 min-h-[44px]" 
              icon={isSharingImage ? <Loader2 className="animate-spin" /> : <Share2 size={20} />}
              disabled={isSharingImage}
            >
              {isSharingImage ? 'Processing...' : 'Export or Share Image'}
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
             <Button onClick={onClose} variant="danger" className="flex-1 min-h-[44px]">
               Discard
             </Button>
             <Button 
               onClick={() => onSave && onSave(data)} 
               variant="primary" 
               className="flex-[2] min-h-[44px]"
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
             <span className="text-white/80 font-medium text-xs pl-2">Original Analyzed Scan</span>
             <button 
               onClick={() => setShowImage(false)} 
               aria-label="Close image overlay"
               className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] text-white bg-white/10 rounded-full hover:bg-white/20 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
             >
               <X size={24} aria-hidden="true" />
             </button>
           </div>
           <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-900 rounded-lg border border-gray-800 relative">
             {imageError ? (
               <div className="flex flex-col items-center justify-center text-center max-w-xs p-6 bg-[#070B14] rounded-2xl border border-[#334155]">
                 <span className="text-4xl mb-3">🔒</span>
                 <h4 className="text-xs font-bold text-white mb-1">Image Link Expired</h4>
                 <p className="text-xs text-[#94A3B8] leading-normal">
                   This secure receipt URL has expired or is unreachable. Close this window and refresh to generate a new link.
                 </p>
               </div>
             ) : (
               <img 
                 src={data.scannedImage.startsWith('http') || data.scannedImage.startsWith('data:') ? data.scannedImage : `data:image/jpeg;base64,${data.scannedImage}`} 
                 alt="Processed Scan" 
                 className="max-w-full max-h-full object-contain"
                 onError={() => setImageError(true)}
               />
             )}
           </div>
           <p className="text-center text-white/50 text-xs mt-4 mb-2">
             High-contrast B&W processing optimized for AI extraction.
           </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          itemName={data.storeName || 'Digitized Receipt'}
          expectedInvoiceNumber={data.invoiceNumber || data.id || ''}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export default ReceiptView;