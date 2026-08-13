import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import Button from './Button';

interface DeleteConfirmModalProps {
  title?: string;
  itemName: string;
  expectedInvoiceNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  title = "Confirm Receipt Deletion",
  itemName,
  expectedInvoiceNumber,
  onConfirm,
  onCancel,
  isDeleting = false
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  
  // Use expected invoice number, or store name if no invoice number exists
  const targetCode = (expectedInvoiceNumber && expectedInvoiceNumber !== '-') 
    ? expectedInvoiceNumber.trim() 
    : itemName.trim();

  const isMatched = confirmInput.trim().toLowerCase() === targetCode.toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMatched && !isDeleting) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#DCE3EC] dark:border-[#334155] relative text-[#172033] dark:text-[#F8FAFC]">
        
        {/* Close Button */}
        <button
          onClick={onCancel}
          disabled={isDeleting}
          aria-label="Cancel deletion"
          className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] absolute top-4 right-4 rounded-full text-[#64748B] hover:text-[#172033] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
        >
          <X size={20} />
        </button>

        {/* Warning Icon & Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#DC2626]/20 dark:text-[#F87171] flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#172033] dark:text-[#F8FAFC]">
              {title}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {itemName}
            </p>
          </div>
        </div>

        {/* Instruction Message */}
        <div className="bg-[#F8FAFC] dark:bg-[#1E293B]/60 p-4 rounded-xl border border-[#DCE3EC] dark:border-[#334155] mb-5 text-xs text-[#64748B] dark:text-[#CBD5E1] space-y-2">
          <p>
            Are you sure you want to permanently delete this receipt? This action <strong className="text-[#DC2626] dark:text-[#F87171]">cannot be undone</strong>.
          </p>
          <p className="font-semibold text-[#172033] dark:text-[#F8FAFC]">
            To confirm deletion, please type <span className="font-mono font-bold text-[#2563EB] dark:text-[#60A5FA] bg-[#2563EB]/10 px-2 py-0.5 rounded uppercase select-all">{targetCode}</span> below:
          </p>
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
              Type Invoice Number to Confirm
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`Enter "${targetCode}"`}
              className="w-full h-11 px-3.5 rounded-[10px] border border-[#DCE3EC] dark:border-[#334155] bg-[#F1F5F9] dark:bg-[#1E293B] text-[#172033] dark:text-[#F8FAFC] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onCancel}
              variant="secondary"
              className="flex-1 min-h-[44px]"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              className="flex-1 min-h-[44px]"
              disabled={!isMatched || isDeleting}
              icon={isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default DeleteConfirmModal;
