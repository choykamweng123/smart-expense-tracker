import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { analyzeImageQuality, ImageQualityReport } from '../utils/imageQuality';

interface CameraScannerViewProps {
  onCapture: (file: File) => void;
  onCancel?: () => void;
}

export const CameraScannerView: React.FC<CameraScannerViewProps> = ({
  onCapture,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<ImageQualityReport>({
    brightness: 128,
    sharpness: 20,
    lightingStatus: 'good',
    sharpnessStatus: 'sharp',
    isReadyForOcr: true,
    score: 85,
    feedbackMessage: 'Position receipt inside the frame',
  });

  // Start camera stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera streaming is not supported in this browser. Please use photo upload.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setIsCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was not granted. You can still snap photos using the button below.');
      } else {
        setCameraError('Live camera stream is unavailable. You can take a photo with your device camera directly.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera(cameraFacing);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [cameraFacing, startCamera]);

  // Real-time video quality inspection interval
  useEffect(() => {
    if (!isCameraActive) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const report = analyzeImageQuality(video, video.videoWidth, video.videoHeight);
          setQualityReport(report);
        } catch {
          // Ignore transient frame read errors
        }
      }
    }, 220);

    return () => clearInterval(interval);
  }, [isCameraActive]);

  // Capture snapshot from video stream
  const handleCaptureSnapshot = () => {
    const video = videoRef.current;
    if (!video || !isCameraActive) {
      fileInputRef.current?.click();
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `receipt-snap-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          onCapture(file);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleToggleCamera = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black/80 border border-white/10 shadow-2xl flex flex-col items-center">
      {/* Hidden file input for native device camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onCapture(e.target.files[0]);
          }
        }}
      />

      {/* Main Viewfinder Box */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[360px] bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isCameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fallback / Error State */}
        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 backdrop-blur-md">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Camera className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">
              Device Camera
            </p>
            <p className="text-xs text-slate-400 max-w-xs mb-4">
              {cameraError || 'Use your camera to snap receipts with automatic quality validation.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition"
            >
              <Camera className="h-4 w-4" />
              Take Photo with Camera
            </button>
          </div>
        )}

        {/* Live HUD Overlay (when camera stream is active) */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
            {/* Top Status Bar: Live Quality Indicators */}
            <div className="flex items-center justify-between gap-2">
              {/* Quality & Readiness Badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md border shadow-md transition-colors ${
                  qualityReport.isReadyForOcr
                    ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
                    : qualityReport.score >= 60
                    ? 'bg-amber-500/25 border-amber-400/40 text-amber-200'
                    : 'bg-rose-500/25 border-rose-400/40 text-rose-200'
                }`}
              >
                {qualityReport.isReadyForOcr ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span>
                  {qualityReport.isReadyForOcr
                    ? `OCR Ready (${qualityReport.score}%)`
                    : qualityReport.score >= 60
                    ? `Suboptimal (${qualityReport.score}%)`
                    : `Low Quality (${qualityReport.score}%)`}
                </span>
              </div>

              {/* Lighting & Sharpness Micro-badges */}
              <div className="flex items-center gap-1.5">
                {/* Lighting Status */}
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md border ${
                    qualityReport.lightingStatus === 'good'
                      ? 'bg-black/60 border-emerald-500/40 text-emerald-300'
                      : qualityReport.lightingStatus === 'dark'
                      ? 'bg-black/70 border-amber-500/40 text-amber-300'
                      : 'bg-black/70 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {qualityReport.lightingStatus === 'good' ? (
                    <Sun className="h-3 w-3 text-emerald-400" />
                  ) : qualityReport.lightingStatus === 'dark' ? (
                    <Moon className="h-3 w-3 text-amber-400" />
                  ) : (
                    <Sun className="h-3 w-3 text-amber-400" />
                  )}
                  <span>
                    {qualityReport.lightingStatus === 'good'
                      ? 'Lighting: Good'
                      : qualityReport.lightingStatus === 'dark'
                      ? 'Too Dark'
                      : 'Glare Detected'}
                  </span>
                </div>

                {/* Sharpness Status */}
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md border ${
                    qualityReport.sharpnessStatus === 'sharp'
                      ? 'bg-black/60 border-emerald-500/40 text-emerald-300'
                      : qualityReport.sharpnessStatus === 'acceptable'
                      ? 'bg-black/70 border-amber-500/40 text-amber-300'
                      : 'bg-black/70 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  <span>
                    {qualityReport.sharpnessStatus === 'sharp'
                      ? 'Sharp Focus'
                      : qualityReport.sharpnessStatus === 'acceptable'
                      ? 'Moderate Focus'
                      : 'Blurry / Motion'}
                  </span>
                </div>
              </div>
            </div>

            {/* Receipt Framing Guide (Corner Brackets) */}
            <div className="relative mx-auto w-[82%] h-[68%] rounded-2xl border-2 border-dashed border-white/25 pointer-events-none flex items-center justify-center">
              {/* Corner L-brackets */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-indigo-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-indigo-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-indigo-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-indigo-400 rounded-br-lg" />

              {/* Center subtle scan line */}
              <div className="text-[11px] text-white/70 font-medium bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-sm text-center">
                Align receipt inside box
              </div>
            </div>

            {/* Bottom Live Feedback Message */}
            <div className="text-center">
              <span
                className={`inline-block text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-md border shadow ${
                  qualityReport.isReadyForOcr
                    ? 'bg-black/70 border-emerald-500/30 text-emerald-200'
                    : 'bg-black/80 border-amber-500/40 text-amber-200'
                }`}
              >
                {qualityReport.feedbackMessage}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Camera Controls Footer */}
      {isCameraActive && (
        <div className="w-full bg-slate-900/90 border-t border-white/10 p-3.5 flex items-center justify-between gap-3">
          {/* Flip Camera */}
          <button
            type="button"
            onClick={handleToggleCamera}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition border border-white/10"
            title="Switch front/back camera"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Flip Camera</span>
          </button>

          {/* Shutter Capture Button */}
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            className={`relative flex items-center justify-center h-13 w-13 rounded-full transition-all shadow-xl active:scale-95 ${
              qualityReport.isReadyForOcr
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-4 ring-emerald-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-4 ring-indigo-500/30'
            }`}
            title="Capture receipt photo"
          >
            <Camera className="h-6 w-6" />
          </button>

          {/* Native photo browse button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition border border-white/10"
            title="Browse photos or use device camera"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">File Pick</span>
          </button>
        </div>
      )}
    </div>
  );
};
