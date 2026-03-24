import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera } from 'lucide-react';
import { Button } from './ui';
import { BaroLogo } from './BaroLogo';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        // Try with environment facing mode first (back camera)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch (e) {
          console.warn("[Camera] Environment mode failed, using default video stream.");
          // Fallback to any available camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setLoading(false);
          requestAnimationFrame(tick);
        }
      } catch (err: any) {
        let msg = 'Unable to access camera.';
        if (!window.isSecureContext) {
          msg = 'Camera access requires a secure context (HTTPS). On mobile, please test via localhost or use a tunnel.';
        } else if (err.name === 'NotAllowedError') {
          msg = 'Camera permission was denied. Please allow it in browser settings.';
        } else if (err.name === 'NotFoundError') {
          msg = 'No camera device found on this system.';
        }
        setError(msg);
        setLoading(false);
        console.error(err);
      }
    };



    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (ctx) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Attempt to scan
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code && code.data) {
              // Found a code!
              onScan(code.data);
              return; // Stop scanning loop
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" /> Scan Table QR
        </h3>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/20 rounded-full w-10 h-10 p-0"
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {error ? (
        <div className="text-white text-center p-6 max-w-sm">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <p className="text-red-200">{error}</p>
          </div>
          <Button onClick={onClose} variant="secondary">Close</Button>
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewfinder Overlay */}
          <div className="absolute inset-0 bg-black/50 mask-scan flex items-center justify-center pointer-events-none">
            {/* The hole is created by the SVG mask or we can use borders */}
            <div className="relative w-64 h-64 border-2 border-primary/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Logo in Viewfinder */}
              <div className="absolute -top-16 left-0 right-0 flex justify-center opacity-80">
                <div className="w-12 h-12">
                  <BaroLogo className="w-full h-full" />
                </div>
              </div>

              {/* Corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary -mt-[2px] -ml-[2px] rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary -mt-[2px] -mr-[2px] rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary -mb-[2px] -ml-[2px] rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary -mb-[2px] -mr-[2px] rounded-br-lg"></div>

              {/* Scan Line Animation */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_#217BF4] animate-[scan_2s_infinite]"></div>
            </div>
          </div>

          <div className="absolute bottom-20 left-0 right-0 text-center text-white/90 font-medium px-4">
            {loading ? 'Initializing camera...' : 'Align QR code within the frame'}
          </div>
        </div>
      )}
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
