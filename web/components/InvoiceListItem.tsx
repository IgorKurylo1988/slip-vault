import React from 'react';
import { InvoiceData } from '../types';
import { ChevronRight, ShoppingBag, CreditCard } from 'lucide-react';

interface InvoiceListItemProps {
  invoice: InvoiceData;
  onClick: () => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const InvoiceListItem: React.FC<InvoiceListItemProps> = ({ invoice, onClick }) => {
  const isCredit = invoice.type === 'CREDIT_INVOICE';
  
  return (
    <div 
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${invoice.storeName || 'receipt'} dated ${formatDate(invoice.date)}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="bg-white dark:bg-[#111827] p-4 rounded-2xl shadow-sm border border-[#DCE3EC] dark:border-[#334155] flex items-center justify-between hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] cursor-pointer transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#60A5FA] min-h-[64px] group"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
        {/* Icon Badge */}
        <div className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center shrink-0 ${
          isCredit 
            ? 'bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]' 
            : 'bg-emerald-50 text-[#059669] dark:bg-emerald-950/40 dark:text-[#34D399]'
        }`}>
          {isCredit ? <CreditCard size={20} aria-hidden="true" /> : <ShoppingBag size={20} aria-hidden="true" />}
        </div>
        
        {/* Details - Allow store name up to 2 lines on mobile */}
        <div className="flex flex-col min-w-0 flex-1">
          <h4 className="font-semibold text-sm text-[#172033] dark:text-[#F8FAFC] line-clamp-2 leading-snug break-words">
            {invoice.storeName || "Unknown Store"}
          </h4>
          <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 flex-wrap">
             <span className="whitespace-nowrap font-medium">{formatDate(invoice.date)}</span>
             {invoice.invoiceNumber && (
               <span className="font-mono text-xs text-[#64748B] dark:text-[#94A3B8] truncate max-w-[120px]">
                 #{invoice.invoiceNumber}
               </span>
             )}
          </div>
        </div>
      </div>

      {/* Amount & Arrow */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <span className={`block font-bold text-sm ${
            isCredit 
              ? 'text-[#059669] dark:text-[#34D399]' 
              : 'text-[#172033] dark:text-[#CBD5E1]'
          }`}>
            {isCredit ? '+' : ''}<span className="text-[#F59E0B] font-black mr-0.5">{invoice.currency}</span>{Math.abs(invoice.totalAmount).toFixed(2)}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
            isCredit 
              ? 'bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]' 
              : 'bg-slate-100 text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]'
          }`}>
            {isCredit ? <CreditCard size={10} /> : <ShoppingBag size={10} />}
            {isCredit ? 'Credit' : 'Invoice'}
          </span>
        </div>
        <div className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronRight size={20} className="text-[#94A3B8] group-hover:text-[#2563EB] dark:text-[#64748B] dark:group-hover:text-[#60A5FA] transition-colors" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};

export default InvoiceListItem;