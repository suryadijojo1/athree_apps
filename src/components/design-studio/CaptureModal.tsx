import React, { useState } from 'react';
import {
  X,
  Camera,
  Download,
  Copy,
  Printer,
  Check,
  Ruler,
  Sparkles,
  Shirt,
  Maximize2
} from 'lucide-react';
import { ProductConfig, ApparelColor, ViewAngle } from './designStudioTypes';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  capturedImageUrl: string;
  capturedImageUrlWithGuide?: string;
  productConfig: ProductConfig;
  selectedColor: ApparelColor;
  selectedSize: string;
  activeAngle: ViewAngle;
  onCaptureAgain: (mode: 'mockup' | 'guide' | 'print-area') => Promise<void>;
  isCapturing?: boolean;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({
  isOpen,
  onClose,
  capturedImageUrl,
  capturedImageUrlWithGuide,
  productConfig,
  selectedColor,
  selectedSize,
  activeAngle,
  onCaptureAgain,
  isCapturing = false
}) => {
  const [captureMode, setCaptureMode] = useState<'mockup' | 'guide' | 'print-area'>('guide');
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  if (!isOpen) return null;

  // Measurement for chosen size
  const sizeRow = productConfig.sizeChart.find((r) => r.size === selectedSize) || productConfig.sizeChart[1];

  const currentDisplayImage =
    captureMode === 'guide' && capturedImageUrlWithGuide
      ? capturedImageUrlWithGuide
      : capturedImageUrl;

  const handleDownload = (format: 'jpg' | 'png' = 'jpg') => {
    try {
      setDownloading(true);
      const link = document.createElement('a');
      const filename = `capture-1to1-${productConfig.id}-${selectedColor.name.toLowerCase().replace(/\s+/g, '-')}-${selectedSize}-${activeAngle}.${format}`;
      link.download = filename;
      link.href = currentDisplayImage;
      link.click();
      setTimeout(() => setDownloading(false), 800);
    } catch (e) {
      setDownloading(false);
      alert('Gagal mengunduh gambar');
    }
  };

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard || !window.fetch) {
        throw new Error('Clipboard API tidak didukung di browser ini');
      }
      const res = await fetch(currentDisplayImage);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err: any) {
      // Fallback: Copy data URL as text
      try {
        await navigator.clipboard.writeText(currentDisplayImage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        alert('Gagal menyalin gambar otomatis. Silakan unduh gambar langsung.');
      }
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Izinkan pop-up jendela untuk mencetak.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Skala 1:1 - ${productConfig.fullName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 16px;
              display: flex;
              flex-direction: column;
              align-items: center;
              color: #111827;
            }
            .header {
              text-align: center;
              margin-bottom: 14px;
            }
            .title {
              font-size: 16px;
              font-weight: 800;
              margin: 0;
            }
            .subtitle {
              font-size: 12px;
              color: #4b5563;
              margin-top: 4px;
            }
            .mockup-frame {
              width: 100%;
              max-width: 650px;
              display: flex;
              justify-content: center;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 12px;
              background: #fff;
            }
            .mockup-img {
              max-width: 100%;
              max-height: 700px;
              object-fit: contain;
            }
            .specs {
              margin-top: 14px;
              width: 100%;
              max-width: 650px;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              border-top: 1px solid #e5e7eb;
              padding-top: 8px;
              color: #374151;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">ATHREE STUDIO JAYAPURA — PROOF DESAIN SKALA 1:1</h1>
            <p class="subtitle">${productConfig.fullName} &bull; Warna: ${selectedColor.name} &bull; Ukuran: ${selectedSize} (${sizeRow ? `LD ${sizeRow.lebarDada} cm, P ${sizeRow.panjang} cm, L ${sizeRow.lengan} cm` : ''}) &bull; Sudut: ${activeAngle.toUpperCase()}</p>
          </div>
          <div class="mockup-frame">
            <img class="mockup-img" src="${currentDisplayImage}" alt="Mockup 1:1" />
          </div>
          <div class="specs">
            <span><strong>Skala:</strong> Real 1:1 DTF &amp; Sablon Proportional</span>
            <span><strong>Toleransi Ukuran:</strong> 1 – 2.5 cm</span>
            <span><strong>Dicetak pada:</strong> ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-700/30 flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-150 text-slate-800"
      >
        {/* Header */}
        <div className="bg-[#203166] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-amber-300">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                <span>Capture Gambar Skala 1 : 1</span>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Real 1:1
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Gambar resolusi tinggi siap unduh &amp; kirim ke produksi sablon / konveksi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50 shrink-0">
          {[
            {
              id: 'guide' as const,
              label: 'Mockup + Panduan Ukuran',
              desc: 'Disertai garis ukuran LD, P, L & Mistar CM'
            },
            {
              id: 'mockup' as const,
              label: 'Mockup Baju Bersih',
              desc: 'Tampilan kaos realistik tanpa garis pengukur'
            },
            {
              id: 'print-area' as const,
              label: 'Artwork DTF Saja (30x42cm)',
              desc: 'Area cetak sablon skala 1:1 murni'
            }
          ].map((tab) => {
            const isActive = captureMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={async () => {
                  setCaptureMode(tab.id);
                  await onCaptureAgain(tab.id);
                }}
                disabled={isCapturing}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
                  isActive
                    ? 'bg-[#00871f] text-white border-[#00871f] shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span className="block truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center Preview Display */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center bg-slate-100/70">
          <div className="w-full max-w-[480px] aspect-square bg-white rounded-2xl border border-slate-200 shadow-md p-3 flex items-center justify-center relative overflow-hidden group">
            {isCapturing ? (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold">Mengambil gambar skala 1:1...</span>
              </div>
            ) : currentDisplayImage ? (
              <img
                src={currentDisplayImage}
                alt="Captured 1:1 Mockup"
                className="w-full h-full object-contain select-none"
              />
            ) : (
              <div className="text-slate-400 text-xs">Pratinjau gambar kosong</div>
            )}

            {/* Overlay Real Dimensions Badge */}
            <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-xs text-white p-2 rounded-xl text-[10.5px] flex items-center justify-between opacity-95 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1.5 truncate">
                <Shirt className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {productConfig.title} &bull; {selectedColor.name} &bull; Size {selectedSize}
                </span>
              </div>
              {sizeRow && (
                <div className="flex items-center gap-1 text-amber-300 font-mono font-bold shrink-0">
                  <span>LD: {sizeRow.lebarDada}cm</span>
                  <span>&bull;</span>
                  <span>P: {sizeRow.panjang}cm</span>
                </div>
              )}
            </div>
          </div>

          {/* Size Dimension Table Summary */}
          {sizeRow && (
            <div className="w-full max-w-[480px] mt-3.5 bg-white p-3 rounded-2xl border border-slate-200 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800">Panduan Ukuran Terpilih:</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold text-[11px]">
                  Size {selectedSize}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                <span>
                  Lebar Dada: <strong className="text-emerald-700">{sizeRow.lebarDada} cm</strong>
                </span>
                <span>
                  Panjang: <strong className="text-blue-700">{sizeRow.panjang} cm</strong>
                </span>
                <span>
                  Lengan: <strong className="text-amber-700">{sizeRow.lengan} cm</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="py-2.5 px-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Salin gambar ke papan klip untuk langsung dipaste ke chat WhatsApp / Photoshop"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Salin Gambar</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cetak lembar persetujuan desain skala 1:1"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Cetak 1:1</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload('png')}
              disabled={downloading || isCapturing}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download format PNG transparan kualitas tinggi"
            >
              <Download className="w-4 h-4 text-slate-700" />
              <span>Unduh PNG</span>
            </button>

            <button
              onClick={() => handleDownload('jpg')}
              disabled={downloading || isCapturing}
              className="py-2.5 px-4.5 rounded-xl bg-[#00871f] hover:bg-[#007019] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/20 transition-all cursor-pointer active:scale-95"
              title="Download format JPG resolusi tinggi"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download Gambar (Skala 1:1)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
