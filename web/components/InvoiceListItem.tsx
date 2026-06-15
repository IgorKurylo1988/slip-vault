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
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group hover:border-emerald-200"
    >
      <div className="flex items-center gap-4">
        {/* Icon Badge */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${
          isCredit ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
        }`}>
          {isCredit ? <CreditCard size={20} /> : <ShoppingBag size={20} />}
        </div>
        
        {/* Details */}
        <div className="flex flex-col overflow-hidden">
          <h4 className="font-bold text-slate-800 truncate pr-2">{invoice.storeName || "Unknown Store"}</h4>
          <div className="flex items-center gap-2 text-xs text-slate-500">
             <span>{invoice.date}</span>
             {invoice.items.length > 0 && <span>• {invoice.items.length} items</span>}
          </div>
        </div>
      </div>

      {/* Amount & Arrow */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <span className={`block font-bold ${isCredit ? 'text-blue-600' : 'text-slate-900'}`}>
            {invoice.currency}{Math.abs(invoice.totalAmount).toFixed(2)}
          </span>
          {isCredit && <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">Credit</span>}
        </div>
        <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
      </div>
    </div>
  );
};

export default InvoiceListItem;