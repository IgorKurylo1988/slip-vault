export interface InvoiceItem {
  sku?: string; // MKT / Catalog Number
  name: string;
  quantity: number;
  price: number;
  total?: number;
}

export type InvoiceType = 'INVOICE' | 'CREDIT_INVOICE' | 'RECEIPT' | 'INVALID';

export interface InvoiceData {
  id?: string; // Unique ID for saved invoices
  createdAt?: number; // Timestamp for sorting
  storeName: string;
  storeAddress?: string;
  date: string;
  time?: string;
  invoiceNumber: string;
  type: InvoiceType;
  currency: string;
  items: InvoiceItem[];
  subtotal?: number;
  tax?: number; // VAT / Ma'am
  totalAmount: number;
  confidenceScore: number;
  scannedImage?: string; // Base64 of the processed B&W image
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  PROCESSING = 'PROCESSING',
  VIEWING = 'VIEWING',
  ERROR = 'ERROR'
}

export interface AvatarOption {
  id: string;
  emoji: string;
  label: string;
  bg: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: '1', emoji: '🦊', label: 'Fox', bg: 'bg-orange-500' },
  { id: '2', emoji: '🚀', label: 'Rocket', bg: 'bg-indigo-500' },
  { id: '3', emoji: '⚡', label: 'Lightning', bg: 'bg-amber-500' },
  { id: '4', emoji: '💎', label: 'Diamond', bg: 'bg-cyan-500' },
  { id: '5', emoji: '🦁', label: 'Lion', bg: 'bg-yellow-500' },
  { id: '6', emoji: '🔮', label: 'Magic', bg: 'bg-purple-500' },
  { id: '7', emoji: '🎨', label: 'Artist', bg: 'bg-pink-500' },
  { id: '8', emoji: '🐼', label: 'Panda', bg: 'bg-slate-700' },
  { id: '9', emoji: '👑', label: 'Crown', bg: 'bg-emerald-500' },
];