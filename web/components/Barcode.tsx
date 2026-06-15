import React from 'react';

interface BarcodeProps {
  value: string;
}

const Barcode: React.FC<BarcodeProps> = ({ value }) => {
  // Simple pseudo-random bar generation based on string hash to make it look consistent for the same value
  const generateBars = (str: string) => {
    const bars = [];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate 40 bars
    for (let i = 0; i < 40; i++) {
      // Use the hash to determine width (1, 2, or 3 units)
      const width = Math.abs((hash >> i) % 3) + 1;
      bars.push(width);
    }
    return bars;
  };

  const bars = generateBars(value || "12345678");

  return (
    <div className="flex flex-col items-center select-none opacity-80">
      <div className="flex items-end h-12 gap-[2px]">
        {bars.map((width, i) => (
          <div 
            key={i} 
            className="bg-black rounded-sm"
            style={{ 
              width: `${width * 2}px`, 
              height: '100%' 
            }} 
          />
        ))}
      </div>
      <div className="text-xs font-mono mt-1 tracking-widest text-slate-500">
        {value || "Unknown ID"}
      </div>
    </div>
  );
};

export default Barcode;