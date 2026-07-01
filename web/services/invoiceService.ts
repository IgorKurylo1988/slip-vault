import { InvoiceData } from "../types";

const getApiUrl = (path: string) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base = isLocal ? 'http://localhost:8000' : window.location.origin;
  return `${base}${path}`;
};

const API_URL = getApiUrl('/api');

/**
 * Converts a base64 image to a high-contrast grayscale "scanned document" style.
 * This runs client-side to improve OCR accuracy before sending to the API.
 */
const preprocessImageToScanStyle = (base64Input: string): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(base64Input);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Input);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      const contrast = 45; 
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let cVal = factor * (gray - 128) + 128;
        cVal = Math.max(0, Math.min(255, cVal));
        data[i] = cVal;
        data[i + 1] = cVal;
        data[i + 2] = cVal;
      }

      ctx.putImageData(imgData, 0, 0);
      const processed = canvas.toDataURL('image/jpeg', 0.85);
      resolve(processed.split(',')[1]);
    };
    
    img.onerror = (err) => {
      console.warn("Image preprocessing failed, using original.", err);
      resolve(base64Input);
    };
    
    img.src = `data:image/jpeg;base64,${base64Input}`;
  });
};

/**
 * Sends the preprocessed base64 image to the backend service for OCR and LLM extraction.
 */
const processInvoiceImage = async (base64Image: string): Promise<any> => {
  const scannedImage = await preprocessImageToScanStyle(base64Image);

  const response = await fetch(`${API_URL}/process-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      image: scannedImage
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to process invoice' }));
    throw new Error(errorData.detail || 'Failed to process invoice');
  }

  const data = await response.json();
  data.scannedImage = scannedImage;
  return data;
};

export { processInvoiceImage };
