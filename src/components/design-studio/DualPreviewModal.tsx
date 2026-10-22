import React, { useState } from 'react';
import {
  X,
  Eye,
  Download,
  Printer,
  Shirt,
  Ruler,
  Sparkles,
  Check,
  Edit3
} from 'lucide-react';
import {
  ProductConfig,
  ApparelColor,
  DesignElement,
  ViewAngle
} from './designStudioTypes';
import { ApparelVectorMockup } from './ApparelVectorMockup';

interface DualPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productConfig: ProductConfig;
  selectedColor: ApparelColor;
  selectedSize: string;
  elements: DesignElement[];
  onSelectAngleAndEdit?: (angle: ViewAngle) => void;
}

export const DualPreviewModal: React.FC<DualPreviewModalProps> = ({
  isOpen,
  onClose,
  productConfig,
  selectedColor,
  selectedSize,
  elements,
  onSelectAngleAndEdit
}) => {
  const [downloading, setDownloading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const sizeRow = productConfig.sizeChart.find((r) => r.size === selectedSize) || productConfig.sizeChart[1];
  const frontElements = elements.filter((el) => el.angle === 'depan');
  const backElements = elements.filter((el) => el.angle === 'belakang');

  // Combined Proof Sheet Download
  const handleDownloadCombined = async () => {
    try {
      setDownloading(true);
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      // Clean White Background with subtle header bar
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1600, 1000);

      // Top Header Bar
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, 1600, 90);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('ATHREE STUDIO JAYAPURA — PROOF DESAIN (DEPAN & BELAKANG)', 40, 52);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '16px sans-serif';
      const subtitle = `${productConfig.fullName} | Warna: ${selectedColor.name} | Ukuran: ${selectedSize} (LD ${sizeRow ? sizeRow.lebarDada : 50}cm, P ${sizeRow ? sizeRow.panjang : 70}cm) | Skala 1:1`;
      ctx.fillText(subtitle, 40, 78);

      // Render Front SVG
      const frontSvg = document.getElementById('preview-svg-depan');
      const backSvg = document.getElementById('preview-svg-belakang');

      const renderSvgToImage = (svgEl: HTMLElement | null): Promise<HTMLImageElement | null> => {
        if (!svgEl) return Promise.resolve(null);
        const clone = svgEl.cloneNode(true) as SVGSVGElement;
        clone.style.transform = 'none';
        const xml = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
          };
          img.src = url;
        });
      };

      const [frontImg, backImg] = await Promise.all([
        renderSvgToImage(frontSvg),
        renderSvgToImage(backSvg)
      ]);

      // Draw Front Card Background & Mockup
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(50, 120, 720, 780);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 120, 720, 780);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAMPAK DEPAN (FRONT VIEW)', 80, 165);

      if (frontImg) {
        ctx.drawImage(frontImg, 80, 190, 660, 680);
      }

      // Draw Back Card Background & Mockup
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(830, 120, 720, 780);
      ctx.strokeRect(830, 120, 720, 780);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAMPAK BELAKANG (BACK VIEW)', 860, 165);

      if (backImg) {
        ctx.drawImage(backImg, 860, 190, 660, 680);
      }

      // Footer
      ctx.fillStyle = '#64748B';
      ctx.font = '14px sans-serif';
      ctx.fillText(
        `Proof Desain Skala 1:1 DTF & Sablon • Toleransi Ukuran 1 – 2.5 cm • Tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        50,
        940
      );

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const link = document.createElement('a');
      link.download = `preview-2sisi-${productConfig.id}-${selectedColor.name.toLowerCase().replace(/\s+/g, '-')}-${selectedSize}.jpg`;
      link.href = dataUrl;
      link.click();
      setDownloading(false);
    } catch (e) {
      setDownloading(false);
      alert('Gagal mengunduh preview kombinasi');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 select-none overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl border border-slate-700/30 flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-150 text-slate-800"
      >
        {/* Top Header */}
        <div className="bg-[#1E293B] text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                  Preview Desain — Tampak Depan &amp; Belakang
                </h3>
                <span className="text-[10px] bg-purple-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Dual Mockup
                </span>
                <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Skala 1:1
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {productConfig.fullName} &bull; Warna: <strong>{selectedColor.name}</strong> &bull; Ukuran: <strong>{selectedSize}</strong> {sizeRow ? `(LD: ${sizeRow.lebarDada}cm, P: ${sizeRow.panjang}cm)` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            title="Tutup Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Column Layout: Front & Back */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* 1. TAMPAK DEPAN (FRONT) */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-sm overflow-hidden flex flex-col transition-all">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wide">
                    TAMPAK DEPAN (FRONT)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {frontElements.length} Elemen Desain
                  </span>
                  {onSelectAngleAndEdit && (
                    <button
                      onClick={() => {
                        onSelectAngleAndEdit('depan');
                        onClose();
                      }}
                      className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Edit bagian depan"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Depan</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Front Canvas Preview */}
              <div className="p-4 flex items-center justify-center min-h-[360px] sm:min-h-[440px] bg-slate-50/50">
                <div id="preview-svg-depan" className="w-full max-w-[360px] aspect-[5/6] pointer-events-none">
                  <ApparelVectorMockup
                    productType={productConfig.id}
                    colorHex={selectedColor.hex}
                    colorName={selectedColor.name}
                    imageMockupUrl={selectedColor.imageMockupUrl}
                    angle="depan"
                    showPrintAreaGuide={true}
                    elements={elements}
                    selectedSize={selectedSize}
                    showGarmentMeasurements={true}
                    isScale1to1={true}
                    scale={1}
                  />
                </div>
              </div>

              {/* Front Info Bar */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Area Cetak: <strong>DTF A3 (30 x 42 cm)</strong></span>
                <span className="text-emerald-700 font-bold">Pola Kerah Crewneck 1:1</span>
              </div>
            </div>

            {/* 2. TAMPAK BELAKANG (BACK) */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-sm overflow-hidden flex flex-col transition-all">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wide">
                    TAMPAK BELAKANG (BACK)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {backElements.length} Elemen Desain
                  </span>
                  {onSelectAngleAndEdit && (
                    <button
                      onClick={() => {
                        onSelectAngleAndEdit('belakang');
                        onClose();
                      }}
                      className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Edit bagian belakang"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Belakang</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Back Canvas Preview */}
              <div className="p-4 flex items-center justify-center min-h-[360px] sm:min-h-[440px] bg-slate-50/50">
                <div id="preview-svg-belakang" className="w-full max-w-[360px] aspect-[5/6] pointer-events-none">
                  <ApparelVectorMockup
                    productType={productConfig.id}
                    colorHex={selectedColor.hex}
                    colorName={selectedColor.name}
                    imageMockupUrl={selectedColor.imageMockupUrl}
                    angle="belakang"
                    showPrintAreaGuide={true}
                    elements={elements}
                    selectedSize={selectedSize}
                    showGarmentMeasurements={true}
                    isScale1to1={true}
                    scale={1}
                  />
                </div>
              </div>

              {/* Back Info Bar */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Area Cetak: <strong>Punggung A3 (30 x 42 cm)</strong></span>
                <span className="text-blue-700 font-bold">Jahitan Yoke Half-Moon 1:1</span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-emerald-600" />
            <span>
              Standar Ukuran <strong>{selectedSize}</strong>: LD {sizeRow ? sizeRow.lebarDada : 50} cm &bull; Panjang {sizeRow ? sizeRow.panjang : 70} cm &bull; Lengan {sizeRow ? sizeRow.lengan : 19.5} cm
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Kembali ke Desain
            </button>

            <button
              onClick={handleDownloadCombined}
              disabled={downloading}
              className="py-2.5 px-4.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-purple-950/20 transition-all cursor-pointer active:scale-95"
              title="Unduh 1 lembar gambar berisi tampak depan dan tampak belakang berdampingan"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Menyiapkan Gambar...' : 'Download Preview 2 Sisi (JPG)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
