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

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}