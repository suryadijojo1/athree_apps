import React, { useState } from 'react';
import { Image as ImageIcon, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MockupPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mockupUrl?: string;
  invoiceNo?: string;
  customerName?: string;
}

export const MockupPreviewModal: React.FC<MockupPreviewModalProps> = ({
  isOpen,
  onClose,
  mockupUrl,
  invoiceNo,
  customerName
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen || !mockupUrl) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700 text-slate-800 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold leading-tight">
                Mockup Desain {invoiceNo ? `• ${invoiceNo}` : ''}
              </h4>
              <p className="text-[10px] text-slate-400">
                {customerName ? `Pelanggan: ${customerName} • ` : ''}Preview internal Admin &amp; Kasir (Tidak tercetak)
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs text-slate-200">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
                className="p-1 hover:text-white rounded hover:bg-slate-700"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] px-1">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
                className="p-1 hover:text-white rounded hover:bg-slate-700"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1 hover:text-white rounded hover:bg-slate-700 ml-1 border-l border-slate-700"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center min-h-[300px]">
          <div
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            className="transition-transform duration-100 max-w-full max-h-full flex items-center justify-center"
          >
            <img
              src={mockupUrl}
              alt="Mockup Desain Penuh"
              className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-md border border-slate-200 bg-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 italic">
            Format terkompresi ringan untuk efisiensi penyimpanan Cloud SQL &amp; Firestore.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
