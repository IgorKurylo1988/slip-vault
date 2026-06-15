import { InvoiceData } from "../types";

const API_URL = 'http://localhost:8000/api/invoices';

export const fetchInvoices = async (): Promise<InvoiceData[]> => {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch invoices from the backend service.");
  }
  return response.json();
};

export const saveInvoiceToStorage = async (invoice: InvoiceData): Promise<InvoiceData> => {
  const invoiceToSave = {
    ...invoice,
    id: invoice.id || crypto.randomUUID(),
    createdAt: invoice.createdAt || Date.now(),
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invoiceToSave),
  });

  if (!response.ok) {
    throw new Error("Failed to save invoice to the backend service.");
  }

  return response.json();
};

export const deleteInvoiceFromStorage = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error("Failed to delete invoice from the backend service.");
  }
};