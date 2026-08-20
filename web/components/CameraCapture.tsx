import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import Button from './Button';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>("");

  const startCamera = useCallback(async () => {
    try {
      // Request higher resolution for better OCR
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError("");
    } catch (err) {
      console.error("Error accessing camera:", err);
      // Fallback to basic constraints if HD fails
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
        setError("");
      } catch (fallbackErr) {
        setError("Could not access camera. Please check permissions.");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        // Convert to base64, removing the prefix for the API
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // High quality capture
        const base64 = dataUrl.split(',')[1];
        stopCamera();
        onCapture(base64);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={onCancel} 
          aria-label="Close camera"
          className="w-[44px] h-[44px] min-w-[44px] min-h-[44px] rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#60A5FA]"
        >
          <X size={24} />
        </button>
        <span className="text-white font-medium tracking-wide">Scan Invoice</span>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-white text-center p-6">
            <p className="mb-4">{error}</p>
            <Button onClick={startCamera} variant="secondary">Try Again</Button>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Scanning Overlay Guide */}
        {!error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
             <div className="w-[85%] h-[65%] border-2 border-white/30 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Corners - Now Teal/Emerald to match theme */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl -mt-[2px] -ml-[2px]"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl -mt-[2px] -mr-[2px]"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl -mb-[2px] -ml-[2px]"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-xl -mb-[2px] -mr-[2px]"></div>
                
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
             </div>
             <p className="absolute bottom-24 text-white/90 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
               Position invoice within the frame
             </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black p-8 pb-12 flex justify-center items-center gap-8">
        {!error && (
            <button 
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all active:scale-95 hover:shadow-[0_0_40px_rgba(16,185,129,0.6)]"
            >
              <Camera className="text-emerald-600 w-8 h-8" />
            </button>
        )}
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CameraCapture;