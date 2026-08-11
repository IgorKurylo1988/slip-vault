import React from 'react';
import { InvoiceData } from '../types';
import { ChevronRight, ShoppingBag, CreditCard } from 'lucide-react';

interface InvoiceListItemProps {
  invoice: InvoiceData;
  onClick: () => void;
}

const InvoiceListItem: React.FC<InvoiceListItemProps> = ({ invoice, onClick }) => {
  const isCredit = invoice.type === 'CREDIT_INVOICE';
  
  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-xl shadow-sm border border-[#DCE3EC] flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group hover:border-[#1D4ED8] dark:bg-[#111827] dark:border-[#334155] dark:hover:border-[#2563EB]"
    >
      <div className="flex items-center gap-4">
        {/* Icon Badge */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${
          isCredit 
            ? 'bg-indigo-50 text-[#1D4ED8] dark:bg-indigo-950/50 dark:text-[#2563EB]' 
            : 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/50 dark:text-[#2563EB]'
        }`}>
          {isCredit ? <CreditCard size={20} className="text-[#1D4ED8] dark:text-[#2563EB]" /> : <ShoppingBag size={20} className="text-[#1D4ED8] dark:text-[#2563EB]" />}
        </div>
        
        {/* Details */}
        <div className="flex flex-col overflow-hidden">
          <h4 className="font-bold text-[#1D4ED8] dark:text-[#F8FAFC] truncate pr-2">{invoice.storeName || "Unknown Store"}</h4>
          <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
             <span>{invoice.date}</span>
             {invoice.items.length > 0 && <span>• {invoice.items.length} items</span>}
          </div>
        </div>
      </div>

      {/* Amount & Arrow */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <span className={`block font-bold ${isCredit ? 'text-[#1D4ED8] dark:text-[#2563EB]' : 'text-[#172033] dark:text-[#F8FAFC]'}`}>
            <span className="text-[#F59E0B] font-extrabold mr-0.5">{invoice.currency}</span>{Math.abs(invoice.totalAmount).toFixed(2)}
          </span>
          {isCredit && <span className="text-[10px] uppercase font-bold text-[#1D4ED8] bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">Credit</span>}
        </div>
        <ChevronRight size={18} className="text-[#94A3B8] group-hover:text-[#1D4ED8] dark:text-[#64748B] dark:group-hover:text-[#2563EB] transition-colors" />
      </div>
    </div>
  );
};

export default InvoiceListItem;