import React, { useState } from 'react';
import { X } from 'lucide-react';
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl max-w-[500px] w-full overflow-hidden shadow-2xl border border-slate-200 text-slate-800 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        {/* Top Header matching Image 5 */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-lg text-slate-900 tracking-tight">Panduan Ukuran</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Product Selector Mini Tabs */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {(['tshirt', 'polo', 'hoodie', 'jersey'] as ProductType[]).map((type) => {
            const p = PRODUCT_CATALOG[type];
            const isActive = selectedProduct === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedProduct(type)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#2D3139] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {p.title}
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Black Banner Bar matching Image 5: "Ukuran" */}
          <div className="bg-[#2D3139] text-white text-center py-2.5 rounded-sm font-bold text-sm tracking-wide shadow-xs">
            Ukuran
          </div>

          {/* Clean T-Shirt Vector Diagram with LD, P, L matching Image 5 */}
          <div className="flex justify-center items-center py-2">
            <div className="relative w-64 h-48 flex items-center justify-center">
              <svg viewBox="0 0 240 180" className="w-full h-full text-slate-900">
                {/* T-Shirt Outline */}
                <path
                  d="M 75 35 
                     C 85 46, 155 46, 165 35 
                     L 205 48 
                     L 225 80 
                     L 198 96 
                     L 182 82 
                     L 182 170 
                     L 58 170 
                     L 58 82 
                     L 42 96 
                     L 15 80 
                     L 35 48 
                     Z"
                  fill="#FFFFFF"
                  stroke="#1E232B"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />

                {/* Collar Rib Curved Lines */}
                <path
                  d="M 75 35 C 85 52, 155 52, 165 35 C 150 42, 90 42, 75 35 Z"
                  fill="#FFFFFF"
                  stroke="#1E232B"
                  strokeWidth="1.8"
                />

                {/* Sleeve Left Seam */}
                <path d="M 58 82 L 75 35" stroke="#1E232B" strokeWidth="1.6" />
                {/* Sleeve Right Seam */}
                <path d="M 182 82 L 165 35" stroke="#1E232B" strokeWidth="1.6" />

                {/* LD (Lebar Dada) Measurement Line with Arrows */}
                <line x1="58" y1="92" x2="182" y2="92" stroke="#1E232B" strokeWidth="1.8" />
                <polygon points="58,92 65,88 65,96" fill="#1E232B" />
                <polygon points="182,92 175,88 175,96" fill="#1E232B" />
                <text x="120" y="86" textAnchor="middle" fill="#1E232B" fontSize="13" fontWeight="bold">
                  LD
                </text>

                {/* P (Panjang) Measurement Line with Arrows */}
                <line x1="120" y1="44" x2="120" y2="170" stroke="#1E232B" strokeWidth="1.8" />
                <polygon points="120,44 116,51 124,51" fill="#1E232B" />
                <polygon points="120,170 116,163 124,163" fill="#1E232B" />
                <text x="135" y="145" textAnchor="middle" fill="#1E232B" fontSize="13" fontWeight="bold">
                  P
                </text>

                {/* L (Lengan) Measurement Line with Arrows on Left Sleeve */}
                <line x1="33" y1="46" x2="16" y2="76" stroke="#1E232B" strokeWidth="1.8" />
                <polygon points="33,46 32,53 38,49" fill="#1E232B" />
                <polygon points="16,76 17,69 22,73" fill="#1E232B" />
                <text x="32" y="38" textAnchor="middle" fill="#1E232B" fontSize="13" fontWeight="bold">
                  L
                </text>
              </svg>
            </div>
          </div>

          {/* Size Chart Table matching Image 5 */}
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-[#2D3139] text-white">
                <tr>
                  <th className="py-2.5 px-3 text-center font-bold tracking-tight">Size</th>
                  <th className="py-2.5 px-3 text-center font-bold tracking-tight">Lebar Dada (cm)</th>
                  <th className="py-2.5 px-3 text-center font-bold tracking-tight">Panjang (cm)</th>
                  <th className="py-2.5 px-3 text-center font-bold tracking-tight">Lengan (cm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {currentProduct.sizeChart.map((row) => (
                  <tr key={row.size} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold">{row.size}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{row.lebarDada}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{row.panjang}</td>
                    <td className="py-2.5 px-3 text-center font-medium">{row.lengan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Toleransi Ukuran Note matching Image 5 */}
          <div className="text-right text-xs text-slate-600 font-medium pt-1">
            Toleransi ukuran 1 – 2.5 cm
          </div>
        </div>
      </div>
    </div>
  );
};
