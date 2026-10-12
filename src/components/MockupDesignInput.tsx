import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Maximize2,
  X,
  Sparkles,
  Clipboard,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { compressImage, extractImageFromClipboard } from '../utils/imageCompressor';

interface MockupDesignInputProps {
  mockupDesign?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  isCompact?: boolean;
}

export const MockupDesignInput: React.FC<MockupDesignInputProps> = ({
  mockupDesign = '',
  onChange,
  label = 'Mockup Design (Bisa di-Paste Ctrl+V)',
  isCompact = false
}) => {
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressInfo, setCompressInfo] = useState<string>('');
  const [showFullPreview, setShowFullPreview] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);

  // Proses file gambar (kompresi)
  const processImageFile = async (file: File) => {
    try {
      setIsCompressing(true);
      setCompressInfo('Mengompres mockup...');
      const result = await compressImage(file, 800, 800, 0.65);
      onChange(result.dataUrl);
      setCompressInfo(`${result.sizeKb} KB (${result.width}x${result.height}px)`);
    } catch (err: any) {
      alert(`Gagal memproses gambar: ${err?.message || 'Error tidak diketahui'}`);
    } finally {
      setIsCompressing(false);
    }
  };

  // Handle Clipboard Paste (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const file = extractImageFromClipboard(e);
    if (file) {
      e.preventDefault();
      processImageFile(file);
    }
  };

  // Drag and Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processImageFile(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Global window paste listener: allows pasting mockup image anywhere when input is visible
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const file = extractImageFromClipboard(e);
      if (file) {
        e.preventDefault();
        processImageFile(file);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  // Calculate size info if existing mockupDesign is present but no compressInfo
  useEffect(() => {
    if (mockupDesign && !compressInfo) {
      if (mockupDesign.startsWith('data:image')) {
        const base64Length = mockupDesign.length - (mockupDesign.indexOf(',') + 1);
        const sizeBytes = Math.round((base64Length * 3) / 4);
        const sizeKb = Math.round((sizeBytes / 1024) * 10) / 10;
        setCompressInfo(`${sizeKb} KB (Terkoreksi Ringan)`);
      } else {
        setCompressInfo('Mockup Terlampir');
      }
    }
  }, [mockupDesign, compressInfo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processImageFile(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setCompressInfo('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Direct paste button from system clipboard API
  const handlePasteFromClipboardBtn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        setIsCompressing(true);
        setCompressInfo('Membaca clipboard...');
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], 'clipboard-mockup.png', { type: blob.type });
            await processImageFile(file);
            return;
          }
        }
        setIsCompressing(false);
        setCompressInfo('');
        alert('Tidak ada gambar di clipboard. Silakan salin (Copy) gambar mockup terlebih dahulu, lalu klik tombol ini atau tekan Ctrl+V.');
      } else {
        alert('Browser membatasi akses clipboard langsung. Silakan gunakan tombol Ctrl + V pada keyboard Anda untuk menempel gambar.');
      }
    } catch {
      setIsCompressing(false);
      setCompressInfo('');
      alert('Silakan tekan tombol Ctrl + V pada keyboard untuk menempel gambar mockup.');
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-[#00871f]" />
          <span>{label}</span>
        </label>
        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
          Khusus Preview Admin &amp; Kasir
        </span>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Container / Paste Zone */}
      {!mockupDesign ? (
        <div
          ref={pasteZoneRef}
          tabIndex={0}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all outline-none focus:ring-2 focus:ring-[#00871f] focus:border-[#00871f] ${
            isDragging
              ? 'border-[#00871f] bg-emerald-50/70 scale-[0.99]'
              : 'border-slate-200 hover:border-emerald-500 hover:bg-slate-50/60 bg-white'
          }`}
        >
          {isCompressing ? (
            <div className="py-2.5 flex flex-col items-center justify-center gap-1.5">
              <div className="w-5 h-5 border-2 border-[#00871f] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-slate-600">{compressInfo || 'Sedang mengompres mockup...'}</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-0.5">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-lg bg-emerald-100/80 text-[#00871f] flex items-center justify-center shrink-0">
                  <Clipboard className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">
                      Paste Mockup (Ctrl + V)
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono border border-slate-200">
                      atau Klik Upload
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Otomatis dikompres ringan (&lt; 100 KB) &bull; Khusus preview internal, tidak dicetak di struk
                  </p>
                </div>
              </div>

              {/* Paste button shortcut */}
              <button
                type="button"
                onClick={handlePasteFromClipboardBtn}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-2xs"
                title="Tempel gambar langsung dari clipboard komputer"
              >
                <Clipboard className="w-3 h-3 text-[#00871f]" />
                <span>Tempel Clipboard</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Image Attached State with Thumbnail & Controls */
        <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            {/* Thumbnail */}
            <div
              onClick={() => setShowFullPreview(true)}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer group shrink-0 shadow-2xs"
              title="Klik untuk melihat ukuran penuh"
            >
              <img
                src={mockupDesign}
                alt="Mockup Desain"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Maximize2 className="w-4 h-4" />
              </div>
            </div>

            {/* Details & Actions */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00871f] shrink-0" />
                <span className="truncate">Mockup Desain Terpasang</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {compressInfo && (
                  <span className="text-[9.5px] font-mono px-1.5 py-0.2 bg-white text-slate-700 border border-slate-200 rounded">
                    {compressInfo}
                  </span>
                )}
                <span className="text-[9.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                  ✓ Ringan &amp; Cepat
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5 italic">
                * Khusus preview internal Admin &amp; Kasir (tidak dicetak di struk)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowFullPreview(true)}
                className="px-2 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#00871f] border border-slate-200 hover:border-emerald-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Lihat ukuran besar"
              >
                <Maximize2 className="w-3 h-3 text-[#00871f]" />
                <span>Lihat</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Ganti gambar mockup"
              >
                <Upload className="w-3 h-3 text-amber-600" />
                <span>Ganti</span>
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="px-2 py-1 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Hapus mockup"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIGHTBOX / FULL MODAL PREVIEW
      ========================================================================= */}
      {showFullPreview && mockupDesign && (
        <div
          onClick={() => setShowFullPreview(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700 text-slate-800 animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold leading-tight">Preview Mockup Desain</h4>
                  <p className="text-[10px] text-slate-400">Khusus internal Admin &amp; Kasir (Tidak tercetak di struk)</p>
                </div>
              </div>

              {/* Zoom Controls & Close */}
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
                  onClick={() => setShowFullPreview(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Image Display Area */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center min-h-[300px]">
              <div
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                className="transition-transform duration-100 max-w-full max-h-full flex items-center justify-center"
              >
                <img
                  src={mockupDesign}
                  alt="Mockup Desain Penuh"
                  className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-md border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 italic">
                Gambar telah dikompres otomatis agar efisien dan cepat diakses.
              </span>
              <button
                type="button"
                onClick={() => setShowFullPreview(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
