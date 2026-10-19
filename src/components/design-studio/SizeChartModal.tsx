import React, { useState } from 'react';
import { X, Ruler, Info, Check } from 'lucide-react';
import { ProductType, PRODUCT_CATALOG } from './designStudioTypes';

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductType?: ProductType;
}

export const SizeChartModal: React.FC<SizeChartModalProps> = ({
  isOpen,
  onClose,
  initialProductType = 'tshirt'
}) => {
  const [selectedProduct, setSelectedProduct] = useState<ProductType>(initialProductType);

  if (!isOpen) return null;

  const currentProduct = PRODUCT_CATALOG[selectedProduct];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 text-slate-800 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm tracking-wide">Panduan Ukuran (Real 1:1)</h3>
              <p className="text-[11px] text-slate-400">Standar ukuran konveksi &amp; apparel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Type Tabs */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-slate-50">
          {(['tshirt', 'polo', 'hoodie', 'jersey'] as ProductType[]).map((type) => {
            const p = PRODUCT_CATALOG[type];
            const isActive = selectedProduct === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedProduct(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {p.title}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Black Banner Bar matching Image 5 */}
          <div className="bg-[#2D3139] text-white text-center py-2 rounded-lg font-bold text-xs tracking-wider shadow-inner">
            Ukuran: {currentProduct.fullName}
          </div>

          {/* Diagram Illustration showing LD, P, L (matching Image 5) */}
          <div className="flex justify-center items-center py-2 bg-slate-50/70 rounded-xl border border-slate-100">
            <div className="relative w-56 h-44 flex items-center justify-center">
              {/* SVG Illustration of T-shirt with measurement indicators */}
              <svg viewBox="0 0 200 160" className="w-full h-full text-slate-800">
                {/* T-Shirt Outline */}
                <path
                  d="M 65 30 
                     C 75 42, 125 42, 135 30 
                     L 165 42 
                     L 185 68 
                     L 165 82 
                     L 150 72 
                     L 150 145 
                     L 50 145 
                     L 50 72 
                     L 35 82 
                     L 15 68 
                     L 35 42 
                     Z"
                  fill="#FFFFFF"
                  stroke="#2D3139"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />

                {/* Collar Rib */}
                <path
                  d="M 65 30 C 75 46, 125 46, 135 30 C 122 38, 78 38, 65 30 Z"
                  fill="#F3F4F6"
                  stroke="#2D3139"
                  strokeWidth="1.6"
                />

                {/* Sleeve Left Seam */}
                <path d="M 50 72 L 65 30" stroke="#2D3139" strokeWidth="1.2" strokeDasharray="2,2" />
                {/* Sleeve Right Seam */}
                <path d="M 150 72 L 135 30" stroke="#2D3139" strokeWidth="1.2" strokeDasharray="2,2" />

                {/* LD (Lebar Dada) Measurement Line */}
                <line x1="50" y1="90" x2="150" y2="90" stroke="#00871f" strokeWidth="1.8" />
                <polygon points="50,90 56,87 56,93" fill="#00871f" />
                <polygon points="150,90 144,87 144,93" fill="#00871f" />
                <rect x="88" y="77" width="24" height="15" rx="3" fill="#FFFFFF" stroke="#00871f" strokeWidth="1" />
                <text x="100" y="88" textAnchor="middle" fill="#00871f" fontSize="10" fontWeight="bold">
                  LD
                </text>

                {/* P (Panjang) Measurement Line */}
                <line x1="100" y1="38" x2="100" y2="145" stroke="#2563EB" strokeWidth="1.8" />
                <polygon points="100,38 97,44 103,44" fill="#2563EB" />
                <polygon points="100,145 97,139 103,139" fill="#2563EB" />
                <rect x="104" y="105" width="16" height="15" rx="3" fill="#FFFFFF" stroke="#2563EB" strokeWidth="1" />
                <text x="112" y="116" textAnchor="middle" fill="#2563EB" fontSize="10" fontWeight="bold">
                  P
                </text>

                {/* L (Lengan) Measurement Line */}
                <line x1="33" y1="40" x2="15" y2="66" stroke="#D97706" strokeWidth="1.8" />
                <polygon points="33,40 31,46 37,42" fill="#D97706" />
                <polygon points="15,66 17,60 21,64" fill="#D97706" />
                <text x="20" y="38" textAnchor="middle" fill="#D97706" fontSize="11" fontWeight="bold">
                  L
                </text>
              </svg>
            </div>
          </div>

          {/* Real 1:1 Size Table matching Image 5 */}
          <div className="overflow-hidden border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#2D3139] text-white">
                <tr>
                  <th className="py-2.5 px-3 text-center font-bold">Size</th>
                  <th className="py-2.5 px-3 text-center font-bold">Lebar Dada (cm)</th>
                  <th className="py-2.5 px-3 text-center font-bold">Panjang (cm)</th>
                  <th className="py-2.5 px-3 text-center font-bold">Lengan (cm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentProduct.sizeChart.map((row, idx) => (
                  <tr
                    key={row.size}
                    className={`transition-colors hover:bg-emerald-50/60 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-extrabold text-slate-800">
                      {row.size}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-emerald-800 bg-emerald-50/40">
                      {row.lebarDada}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-blue-800 bg-blue-50/40">
                      {row.panjang}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-amber-800 bg-amber-50/40">
                      {row.lengan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tolerance Note */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span className="italic flex items-center gap-1 text-slate-600">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              {currentProduct.sizeChartNote}
            </span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Skala Asli 1:1
            </span>
          </div>

          {/* Cara Ukur Guide */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600">
            <p className="font-bold text-slate-800">Cara Pengukuran:</p>
            <p>
              &bull; <strong className="text-emerald-700">LD (Lebar Dada)</strong>: Diukur mendatar dari bawah ketiak kiri ke ketiak kanan.
            </p>
            <p>
              &bull; <strong className="text-blue-700">P (Panjang)</strong>: Diukur vertikal dari titik tertinggi bahu leher sampai ke ujung bawah baju.
            </p>
            <p>
              &bull; <strong className="text-amber-700">L (Lengan)</strong>: Diukur dari jahitan puncak bahu hingga ke ujung pergelangan/keliman lengan.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#00871f] hover:bg-[#007019] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Mengerti &amp; Kembali
          </button>
        </div>
      </div>
    </div>
  );
};
