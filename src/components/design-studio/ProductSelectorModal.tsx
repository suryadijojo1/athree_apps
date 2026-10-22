import React from 'react';
import { X, Sparkles, ChevronRight, Layers } from 'lucide-react';
import { ProductType, PRODUCT_CATALOG } from './designStudioTypes';

interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (productType: ProductType) => void;
}

export const ProductSelectorModal: React.FC<ProductSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct
}) => {
  if (!isOpen) return null;

  const products: {
    type: ProductType;
    numberBadge: string;
    title: string;
    countLabel: string;
    badgeColor: string;
    bgAccent: string;
    previewColor: string;
    description: string;
    sizeNote?: string;
  }[] = [
    {
      type: 'tshirt',
      numberBadge: '1',
      title: 'Kaos T -Shirt',
      countLabel: 'Real 1:1',
      badgeColor: 'bg-lime-100 text-lime-800 border-lime-200',
      bgAccent: 'from-lime-500/10 to-emerald-500/5',
      previewColor: '#84CC16', // Lime Green matching Image 1
      description: 'Kaos O-Neck reguler fit katun combed halus. Skala real 1:1 dari aslinya.',
      sizeNote: 'Panduan Ukuran T-Shirt Terlampir (S - 5XL)'
    },
    {
      type: 'polo',
      numberBadge: '2',
      title: 'Polo (Kaos Polo-Shirt)',
      countLabel: 'Real 1:1',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      bgAccent: 'from-amber-500/10 to-orange-500/5',
      previewColor: '#701A24', // Maroon matching Image 2
      description: 'Kaos polo berkerah bahan pique premium dengan 3 kancing rapi & placket bersih.',
      sizeNote: 'Panduan Ukuran Polo Terlampir (S - 3XL)'
    },
    {
      type: 'hoodie',
      numberBadge: '3',
      title: 'Hoodie (Jacket & Hoodies)',
      countLabel: 'Real 1:1',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      bgAccent: 'from-purple-500/10 to-indigo-500/5',
      previewColor: '#C084FC', // Lilac matching Image 3
      description: 'Hoodie fleece tebal preshrunk hangat, kupluk bertali & saku kanguru depan.',
      sizeNote: 'Panduan Ukuran Hoodie Terlampir (S - 2XL)'
    },
    {
      type: 'jersey',
      numberBadge: '4',
      title: 'Jersey (Sport T-Shirts)',
      countLabel: 'Real 1:1',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      bgAccent: 'from-blue-500/10 to-sky-500/5',
      previewColor: '#F3F4F6', // Crisp White matching Image 4
      description: 'Jersey microfiber dry-fit 150 gsm cepat kering, sublimasi & sablon olahraga.',
      sizeNote: 'Panduan Ukuran Jersey Terlampir (S - 3XL)'
    }
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-800 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header matching Image 1 */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#00871f]" />
              <span>Mulai Design Custom</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pilih produk yang ingin kamu custom
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Cards Grid matching Image 1 */}
        <div className="py-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 flex-1">
          {products.map((p) => {
            return (
              <div
                key={p.type}
                onClick={() => {
                  onSelectProduct(p.type);
                }}
                className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-[#00871f] p-3 transition-all duration-200 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                {/* Visual Preview Box with Apparel Silhouette */}
                <div
                  className={`w-full aspect-square rounded-xl bg-gradient-to-b ${p.bgAccent} border border-slate-100 flex items-center justify-center p-3 relative overflow-hidden group-hover:scale-[1.02] transition-transform`}
                >
                  {/* Vector Silhouette Preview */}
                  {p.type === 'tshirt' && (
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                      <path
                        d="M 70 30 C 85 45, 115 45, 130 30 L 165 42 L 185 75 L 160 95 L 150 80 L 150 175 L 50 175 L 50 80 L 40 95 L 15 75 L 35 42 Z"
                        fill={p.previewColor}
                        stroke="#111827"
                        strokeOpacity="0.15"
                        strokeWidth="1.2"
                      />
                      <path d="M 70 30 C 85 48, 115 48, 130 30" stroke="#111827" strokeOpacity="0.2" strokeWidth="1.5" fill="none" />
                    </svg>
                  )}

                  {p.type === 'hoodie' && (
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                      <path
                        d="M 65 35 C 80 45, 120 45, 135 35 L 170 50 L 190 100 L 165 115 L 155 95 L 155 180 L 45 180 L 45 95 L 35 115 L 10 100 L 30 50 Z"
                        fill={p.previewColor}
                        stroke="#111827"
                        strokeOpacity="0.15"
                        strokeWidth="1.2"
                      />
                      {/* Hood */}
                      <path d="M 65 35 C 55 15, 85 8, 100 8 C 115 8, 145 15, 135 35 C 120 55, 80 55, 65 35 Z" fill={p.previewColor} stroke="#111827" strokeOpacity="0.2" strokeWidth="1.2" />
                      {/* Drawstrings */}
                      <line x1="90" y1="50" x2="88" y2="85" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                      <line x1="110" y1="50" x2="112" y2="85" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                      {/* Kangaroo pocket */}
                      <path d="M 65 125 L 135 125 L 145 170 L 55 170 Z" fill={p.previewColor} stroke="#111827" strokeOpacity="0.2" strokeWidth="1.2" />
                    </svg>
                  )}

                  {p.type === 'polo' && (
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                      <path
                        d="M 70 30 C 85 40, 115 40, 130 30 L 165 42 L 182 78 L 160 95 L 150 80 L 150 175 L 50 175 L 50 80 L 40 95 L 18 78 L 35 42 Z"
                        fill={p.previewColor}
                        stroke="#111827"
                        strokeOpacity="0.15"
                        strokeWidth="1.2"
                      />
                      {/* Polo Collar */}
                      <path d="M 70 30 C 76 34, 86 36, 92 45 L 90 60 C 80 55, 74 42, 70 30 Z" fill={p.previewColor} stroke="#111827" strokeOpacity="0.2" strokeWidth="1" />
                      <path d="M 130 30 C 124 34, 114 36, 108 45 L 110 60 C 120 55, 126 42, 130 30 Z" fill={p.previewColor} stroke="#111827" strokeOpacity="0.2" strokeWidth="1" />
                      {/* Placket */}
                      <rect x="94" y="44" width="12" height="38" rx="1" fill={p.previewColor} stroke="#111827" strokeOpacity="0.2" strokeWidth="1" />
                      <circle cx="100" cy="50" r="1.5" fill="#E5E7EB" />
                      <circle cx="100" cy="60" r="1.5" fill="#E5E7EB" />
                      <circle cx="100" cy="70" r="1.5" fill="#E5E7EB" />
                    </svg>
                  )}

                  {p.type === 'jersey' && (
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                      <path
                        d="M 72 30 C 85 42, 115 42, 128 30 L 165 42 L 185 75 L 160 95 L 150 80 L 150 175 L 50 175 L 50 80 L 40 95 L 15 75 L 35 42 Z"
                        fill={p.previewColor}
                        stroke="#9CA3AF"
                        strokeWidth="1.5"
                      />
                      {/* Raglan lines */}
                      <path d="M 72 30 C 64 50, 56 68, 50 80" stroke="#3B82F6" strokeWidth="2" strokeDasharray="3,2" fill="none" />
                      <path d="M 128 30 C 136 50, 144 68, 150 80" stroke="#3B82F6" strokeWidth="2" strokeDasharray="3,2" fill="none" />
                      {/* Sport stripes */}
                      <line x1="50" y1="90" x2="55" y2="175" stroke="#3B82F6" strokeWidth="3" />
                      <line x1="150" y1="90" x2="145" y2="175" stroke="#3B82F6" strokeWidth="3" />
                    </svg>
                  )}

                  {/* Corner Badge */}
                  <span
                    className={`absolute top-2.5 right-2.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${p.badgeColor}`}
                  >
                    {p.countLabel}
                  </span>
                </div>

                {/* Card Bottom Meta matching Image 1 */}
                <div className="pt-3 pb-1 text-left">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      {p.numberBadge}
                    </span>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-[#00871f] transition-colors flex-1 flex items-center justify-between">
                      <span>{p.title}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#00871f] group-hover:translate-x-0.5 transition-all" />
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                  {p.sizeNote && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-[#00871f] border border-emerald-200 text-[10px] font-bold">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>{p.sizeNote}</span>
                    </div>
                  )}
                </div>

                {/* Start Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    className="w-full py-1.5 px-3 bg-slate-100 group-hover:bg-[#00871f] text-slate-700 group-hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Mulai Desain</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#00871f]" />
            Semua produk mendukung skala real 1:1, panduan ukuran, multi-sudut, dan ekspor ke invoice.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
