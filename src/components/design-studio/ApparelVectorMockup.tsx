import React from 'react';
import { ProductType, ViewAngle, DesignElement } from './designStudioTypes';

interface ApparelVectorMockupProps {
  productType: ProductType;
  colorHex: string;
  angle: ViewAngle;
  showPrintAreaGuide?: boolean;
  elements?: DesignElement[];
  onSelectElement?: (id: string | null) => void;
  selectedElementId?: string | null;
  onUpdateElementPosition?: (id: string, x: number, y: number) => void;
  isExporting?: boolean;
  scale?: number;
}

export const ApparelVectorMockup: React.FC<ApparelVectorMockupProps> = ({
  productType,
  colorHex,
  angle,
  showPrintAreaGuide = true,
  elements = [],
  onSelectElement,
  selectedElementId,
  onUpdateElementPosition,
  isExporting = false,
  scale = 1
}) => {
  // Elements active for current angle
  const currentAngleElements = elements.filter((el) => el.angle === angle);

  // Determine printable area coordinates (x, y, width, height in SVG viewbox units 0-500 x 0-600)
  const getPrintArea = () => {
    switch (angle) {
      case 'depan':
        if (productType === 'hoodie') {
          return { x: 175, y: 155, width: 150, height: 130, label: 'Area Sablon Dada (28 x 20 cm)' };
        }
        if (productType === 'polo') {
          return { x: 165, y: 195, width: 170, height: 210, label: 'Area Cetak Bordir / DTF' };
        }
        // tshirt & jersey
        return { x: 160, y: 140, width: 180, height: 250, label: 'Area Cetak A3 (30 x 42 cm)' };
      case 'belakang':
        return { x: 160, y: 120, width: 180, height: 260, label: 'Area Cetak Punggung (A3)' };
      case 'lengan-kiri':
      case 'lengan-kanan':
        return { x: 180, y: 160, width: 140, height: 160, label: 'Area Cetak Lengan (10 x 12 cm)' };
      case 'label':
        return { x: 160, y: 200, width: 180, height: 150, label: 'Area Sablon Label Kerah (6 x 6 cm)' };
      default:
        return { x: 160, y: 140, width: 180, height: 250, label: 'Area Cetak' };
    }
  };

  const printArea = getPrintArea();

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none overflow-hidden">
      <svg
        id="apparel-mockup-svg"
        viewBox="0 0 500 600"
        className="w-full h-full max-h-[580px] drop-shadow-xl transition-all duration-200"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        <defs>
          {/* Shadow & Fabric Shader Filter */}
          <radialGradient id="fabricShading" cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="65%" stopColor="#000000" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
          </radialGradient>

          <linearGradient id="bodyVerticalLighting" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.18" />
            <stop offset="15%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.16" />
            <stop offset="85%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
          </linearGradient>

          {/* Heather / Mesh Texture Pattern */}
          <pattern id="meshPattern" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.6" fill="#000000" fillOpacity="0.05" />
          </pattern>
        </defs>

        {/* =========================================================================
            1. T-SHIRT (FRONT / BACK / SLEEVE / LABEL)
        ========================================================================= */}
        {productType === 'tshirt' && angle === 'depan' && (
          <g id="tshirt-front">
            {/* Base Body & Sleeves */}
            <path
              d="M 175 75 
                 C 205 105, 295 105, 325 75 
                 L 405 105 
                 L 460 185 
                 L 395 235 
                 L 370 200 
                 L 370 520 
                 C 370 535, 130 535, 130 520 
                 L 130 200 
                 L 105 235 
                 L 40 185 
                 L 95 105 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            {/* Shading Layer */}
            <path
              d="M 175 75 C 205 105, 295 105, 325 75 L 405 105 L 460 185 L 395 235 L 370 200 L 370 520 C 370 535, 130 535, 130 520 L 130 200 L 105 235 L 40 185 L 95 105 Z"
              fill="url(#fabricShading)"
            />
            <path
              d="M 175 75 C 205 105, 295 105, 325 75 L 405 105 L 460 185 L 395 235 L 370 200 L 370 520 C 370 535, 130 535, 130 520 L 130 200 L 105 235 L 40 185 L 95 105 Z"
              fill="url(#bodyVerticalLighting)"
            />

            {/* Collar Ribbing (Crewneck 1:1) */}
            <path
              d="M 175 75 C 205 118, 295 118, 325 75 C 290 98, 210 98, 175 75 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <path
              d="M 175 75 C 205 118, 295 118, 325 75 C 290 98, 210 98, 175 75 Z"
              fill="#000000"
              fillOpacity="0.12"
            />

            {/* Inner Back Neck Collar Hole */}
            <path
              d="M 175 75 C 210 90, 290 90, 325 75 C 310 65, 190 65, 175 75 Z"
              fill="#000000"
              fillOpacity="0.25"
            />

            {/* Sleeve Seams */}
            <path d="M 130 200 C 135 150, 150 110, 175 75" stroke="#000000" strokeOpacity="0.18" strokeWidth="1.5" fill="none" />
            <path d="M 370 200 C 365 150, 350 110, 325 75" stroke="#000000" strokeOpacity="0.18" strokeWidth="1.5" fill="none" />

            {/* Sleeve Hem lines */}
            <line x1="42" y1="184" x2="103" y2="233" stroke="#000000" strokeOpacity="0.2" strokeWidth="1.2" />
            <line x1="458" y1="184" x2="397" y2="233" stroke="#000000" strokeOpacity="0.2" strokeWidth="1.2" />

            {/* Bottom Hem Double Stitch */}
            <path d="M 130 515 C 200 524, 300 524, 370 515" stroke="#000000" strokeOpacity="0.22" strokeWidth="1" fill="none" strokeDasharray="3,2" />
          </g>
        )}

        {productType === 'tshirt' && angle === 'belakang' && (
          <g id="tshirt-back">
            <path
              d="M 175 70 
                 C 210 82, 290 82, 325 70 
                 L 405 105 
                 L 460 185 
                 L 395 235 
                 L 370 200 
                 L 370 520 
                 C 370 535, 130 535, 130 520 
                 L 130 200 
                 L 105 235 
                 L 40 185 
                 L 95 105 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d="M 175 70 C 210 82, 290 82, 325 70 L 405 105 L 460 185 L 395 235 L 370 200 L 370 520 C 370 535, 130 535, 130 520 L 130 200 L 105 235 L 40 185 L 95 105 Z"
              fill="url(#fabricShading)"
            />
            {/* Back Collar Band */}
            <path
              d="M 175 70 C 210 82, 290 82, 325 70 C 310 64, 190 64, 175 70 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            {/* Half Moon / Yoke Stitches */}
            <path d="M 175 75 C 210 115, 290 115, 325 75" stroke="#000000" strokeOpacity="0.15" strokeWidth="1" fill="none" strokeDasharray="3,2" />
            <path d="M 130 200 C 135 150, 150 110, 175 70" stroke="#000000" strokeOpacity="0.18" strokeWidth="1.5" fill="none" />
            <path d="M 370 200 C 365 150, 350 110, 325 70" stroke="#000000" strokeOpacity="0.18" strokeWidth="1.5" fill="none" />
            <path d="M 130 515 C 200 524, 300 524, 370 515" stroke="#000000" strokeOpacity="0.22" strokeWidth="1" fill="none" strokeDasharray="3,2" />
          </g>
        )}

        {/* =========================================================================
            2. POLO T-SHIRT (FRONT / BACK)
        ========================================================================= */}
        {productType === 'polo' && angle === 'depan' && (
          <g id="polo-front">
            {/* Polo Body */}
            <path
              d="M 175 75 
                 C 205 95, 295 95, 325 75 
                 L 405 105 
                 L 450 190 
                 L 395 225 
                 L 370 195 
                 L 370 520 
                 C 370 535, 130 535, 130 520 
                 L 130 195 
                 L 105 225 
                 L 50 190 
                 L 95 105 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d="M 175 75 C 205 95, 295 95, 325 75 L 405 105 L 450 190 L 395 225 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 105 225 L 50 190 L 95 105 Z"
              fill="url(#fabricShading)"
            />

            {/* Polo Fold Collar Left & Right */}
            {/* Left Collar Leaf */}
            <path
              d="M 175 75 C 190 85, 215 90, 230 110 L 225 145 C 200 135, 185 105, 175 75 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
            {/* Right Collar Leaf */}
            <path
              d="M 325 75 C 310 85, 285 90, 270 110 L 275 145 C 300 135, 315 105, 325 75 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />

            {/* Collar Back Neck */}
            <path
              d="M 175 75 C 210 65, 290 65, 325 75 L 315 90 C 285 80, 215 80, 185 90 Z"
              fill="#000000"
              fillOpacity="0.25"
            />

            {/* Placket (Button Box) */}
            <rect
              x="236"
              y="105"
              width="28"
              height="95"
              rx="2"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            {/* Placket Reinforced Bottom Box */}
            <rect x="236" y="180" width="28" height="20" fill="#000000" fillOpacity="0.08" stroke="#000000" strokeOpacity="0.3" strokeWidth="1" />
            <line x1="236" y1="180" x2="264" y2="200" stroke="#000000" strokeOpacity="0.2" strokeWidth="0.8" />
            <line x1="264" y1="180" x2="236" y2="200" stroke="#000000" strokeOpacity="0.2" strokeWidth="0.8" />

            {/* 3 Buttons */}
            <circle cx="250" cy="120" r="4" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />
            <circle cx="250" cy="145" r="4" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />
            <circle cx="250" cy="170" r="4" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />

            {/* Cuffed Sleeve Ribbing */}
            <path d="M 52 188 L 103 223" stroke="#000000" strokeOpacity="0.3" strokeWidth="3" />
            <path d="M 448 188 L 397 223" stroke="#000000" strokeOpacity="0.3" strokeWidth="3" />
          </g>
        )}

        {productType === 'polo' && angle === 'belakang' && (
          <g id="polo-back">
            <path
              d="M 175 70 C 210 80, 290 80, 325 70 L 405 105 L 450 190 L 395 225 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 105 225 L 50 190 L 95 105 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d="M 175 70 C 210 80, 290 80, 325 70 L 405 105 L 450 190 L 395 225 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 105 225 L 50 190 L 95 105 Z"
              fill="url(#fabricShading)"
            />
            {/* Back Collar Turned Down */}
            <path
              d="M 170 65 C 215 55, 285 55, 330 65 L 325 85 C 290 75, 210 75, 175 85 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* =========================================================================
            3. HOODIE (JACKET & HOODIES)
        ========================================================================= */}
        {productType === 'hoodie' && angle === 'depan' && (
          <g id="hoodie-front">
            {/* Hoodie Body with relaxed fleece fit */}
            <path
              d="M 160 85 
                 C 195 105, 305 105, 340 85 
                 L 420 115 
                 L 470 240 
                 L 410 270 
                 L 380 230 
                 L 380 500 
                 L 380 530 
                 L 120 530 
                 L 120 500 
                 L 120 230 
                 L 90 270 
                 L 30 240 
                 L 80 115 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d="M 160 85 C 195 105, 305 105, 340 85 L 420 115 L 470 240 L 410 270 L 380 230 L 380 530 L 120 530 L 120 230 L 90 270 L 30 240 L 80 115 Z"
              fill="url(#fabricShading)"
            />

            {/* Double-Lined Hood */}
            <path
              d="M 160 85 
                 C 140 25, 210 15, 250 15 
                 C 290 15, 360 25, 340 85 
                 C 310 130, 280 135, 250 135 
                 C 220 135, 190 130, 160 85 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <path
              d="M 175 80 C 195 45, 230 40, 250 40 C 270 40, 305 45, 325 80 C 295 115, 205 115, 175 80 Z"
              fill="#000000"
              fillOpacity="0.25"
            />

            {/* Drawstrings with Metal Aglets */}
            <path d="M 225 125 C 220 155, 222 185, 220 215" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <rect x="218" y="215" width="4" height="10" rx="1.5" fill="#9CA3AF" />

            <path d="M 275 125 C 280 155, 278 185, 280 215" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <rect x="278" y="215" width="4" height="10" rx="1.5" fill="#9CA3AF" />

            {/* Kangaroo Pouch Pocket */}
            <path
              d="M 165 340 
                 L 335 340 
                 L 360 480 
                 L 140 480 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <path
              d="M 165 340 L 335 340 L 360 480 L 140 480 Z"
              fill="#000000"
              fillOpacity="0.08"
            />
            {/* Pocket Slanted Hand Openings */}
            <path d="M 165 340 L 140 430" stroke="#000000" strokeOpacity="0.3" strokeWidth="2" />
            <path d="M 335 340 L 360 430" stroke="#000000" strokeOpacity="0.3" strokeWidth="2" />

            {/* Ribbed Bottom Waistband */}
            <rect x="120" y="500" width="260" height="30" fill="#000000" fillOpacity="0.08" stroke="#000000" strokeOpacity="0.25" strokeWidth="1" />
            {/* Sleeve Ribbed Cuffs */}
            <path d="M 32 238 L 92 268" stroke="#000000" strokeOpacity="0.3" strokeWidth="4" />
            <path d="M 468 238 L 408 268" stroke="#000000" strokeOpacity="0.3" strokeWidth="4" />
          </g>
        )}

        {productType === 'hoodie' && angle === 'belakang' && (
          <g id="hoodie-back">
            <path
              d="M 160 80 C 195 95, 305 95, 340 80 L 420 115 L 470 240 L 410 270 L 380 230 L 380 530 L 120 530 L 120 230 L 90 270 L 30 240 L 80 115 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d="M 160 80 C 195 95, 305 95, 340 80 L 420 115 L 470 240 L 410 270 L 380 230 L 380 530 L 120 530 L 120 230 L 90 270 L 30 240 L 80 115 Z"
              fill="url(#fabricShading)"
            />
            {/* Hanging Hood on Back */}
            <path
              d="M 160 80 
                 C 140 160, 210 210, 250 210 
                 C 290 210, 360 160, 340 80 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            <path
              d="M 160 80 C 140 160, 210 210, 250 210 C 290 210, 360 160, 340 80 Z"
              fill="#000000"
              fillOpacity="0.12"
            />
            <rect x="120" y="500" width="260" height="30" fill="#000000" fillOpacity="0.08" stroke="#000000" strokeOpacity="0.25" strokeWidth="1" />
          </g>
        )}

        {/* =========================================================================
            4. JERSEY (SPORT T-SHIRTS)
        ========================================================================= */}
        {productType === 'jersey' && angle === 'depan' && (
          <g id="jersey-front">
            {/* Athletic Sport Body with Raglan Sleeves */}
            <path
              d="M 180 75 
                 C 205 100, 295 100, 320 75 
                 L 410 105 
                 L 465 185 
                 L 400 230 
                 L 370 195 
                 L 370 520 
                 C 370 535, 130 535, 130 520 
                 L 130 195 
                 L 100 230 
                 L 35 185 
                 L 90 105 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            {/* Athletic Sport Mesh Overlay */}
            <path
              d="M 180 75 C 205 100, 295 100, 320 75 L 410 105 L 465 185 L 400 230 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 100 230 L 35 185 L 90 105 Z"
              fill="url(#fabricShading)"
            />
            <path
              d="M 180 75 C 205 100, 295 100, 320 75 L 410 105 L 465 185 L 400 230 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 100 230 L 35 185 L 90 105 Z"
              fill="url(#meshPattern)"
            />

            {/* Sport Raglan Seams (Bahu ke Ketiak) */}
            <path d="M 180 75 C 160 120, 140 160, 130 195" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4,2" fill="none" />
            <path d="M 320 75 C 340 120, 360 160, 370 195" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4,2" fill="none" />

            {/* Dynamic Sport Side Breathable Stripes */}
            <path d="M 130 220 L 145 520" stroke="#000000" strokeOpacity="0.12" strokeWidth="8" fill="none" />
            <path d="M 370 220 L 355 520" stroke="#000000" strokeOpacity="0.12" strokeWidth="8" fill="none" />

            {/* V-insert / Modern Crew Collar */}
            <path
              d="M 180 75 C 205 110, 295 110, 320 75 C 290 92, 210 92, 180 75 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
            <polygon points="245,95 255,95 250,105" fill="#FFFFFF" fillOpacity="0.6" />
          </g>
        )}

        {productType === 'jersey' && angle === 'belakang' && (
          <g id="jersey-back">
            <path
              d="M 180 70 C 210 80, 290 80, 320 70 L 410 105 L 465 185 L 400 230 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 100 230 L 35 185 L 90 105 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d="M 180 70 C 210 80, 290 80, 320 70 L 410 105 L 465 185 L 400 230 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 100 230 L 35 185 L 90 105 Z"
              fill="url(#fabricShading)"
            />
            <path
              d="M 180 70 C 210 80, 290 80, 320 70 L 410 105 L 465 185 L 400 230 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 100 230 L 35 185 L 90 105 Z"
              fill="url(#meshPattern)"
            />
            <path d="M 180 70 C 160 120, 140 160, 130 195" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4,2" fill="none" />
            <path d="M 320 70 C 340 120, 360 160, 370 195" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4,2" fill="none" />
          </g>
        )}

        {/* =========================================================================
            5. SLEEVE VIEWS (LENGAN KIRI / LENGAN KANAN)
        ========================================================================= */}
        {(angle === 'lengan-kiri' || angle === 'lengan-kanan') && (
          <g id="sleeve-view">
            {/* Torso Profile Silhouette */}
            <path d="M 130 60 C 160 65, 340 65, 370 60 L 380 540 L 120 540 Z" fill="#E5E7EB" fillOpacity="0.5" stroke="#D1D5DB" strokeWidth="1" />
            {/* Prominent Sleeve Profile */}
            <path
              d="M 170 80 
                 C 220 70, 280 70, 330 80 
                 L 380 280 
                 L 360 380 
                 L 140 380 
                 L 120 280 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.3"
              strokeWidth="2"
            />
            <path
              d="M 170 80 C 220 70, 280 70, 330 80 L 380 280 L 360 380 L 140 380 L 120 280 Z"
              fill="url(#fabricShading)"
            />
            {/* Shoulder Seam Arc */}
            <path d="M 170 80 C 250 110, 330 80, 330 80" stroke="#000000" strokeOpacity="0.25" strokeWidth="2" fill="none" />
            {/* Sleeve Hem Line */}
            <path d="M 140 370 L 360 370" stroke="#000000" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="3,2" />
          </g>
        )}

        {/* =========================================================================
            6. LABEL VIEW (INSIDE COLLAR / PRINT LABEL)
        ========================================================================= */}
        {angle === 'label' && (
          <g id="label-view">
            {/* Collar Inside Zoom */}
            <rect x="75" y="60" width="350" height="480" rx="20" fill={colorHex} stroke="#000000" strokeOpacity="0.25" strokeWidth="1.5" />
            <rect x="75" y="60" width="350" height="480" rx="20" fill="url(#fabricShading)" />
            {/* Collar Rib Curved Band */}
            <path d="M 75 140 C 180 220, 320 220, 425 140" stroke="#000000" strokeOpacity="0.4" strokeWidth="18" fill="none" />
            <path d="M 75 140 C 180 220, 320 220, 425 140" stroke={colorHex} strokeWidth="14" fill="none" />

            {/* Built-in Fabric Brand Label Tag */}
            <rect x="220" y="80" width="60" height="70" rx="2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1" />
            <line x1="225" y1="95" x2="275" y2="95" stroke="#00871f" strokeWidth="3" />
            <text x="250" y="112" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#1F2937">
              ATHREE
            </text>
            <text x="250" y="122" textAnchor="middle" fontSize="5.5" fill="#4B5563">
              100% COTTON
            </text>
            <text x="250" y="136" textAnchor="middle" fontSize="9" fontWeight="extrabold" fill="#1F2937">
              L
            </text>
          </g>
        )}

        {/* =========================================================================
            7. PRINTABLE AREA BOUNDARY (AREA CETAK 1:1)
        ========================================================================= */}
        {showPrintAreaGuide && !isExporting && (
          <g id="printable-area-guide">
            <rect
              x={printArea.x}
              y={printArea.y}
              width={printArea.width}
              height={printArea.height}
              fill="rgba(0, 135, 31, 0.04)"
              stroke="#00871f"
              strokeWidth="1.5"
              strokeDasharray="5,4"
              rx="4"
              className="pointer-events-none"
            />
            {/* Corner Markers */}
            <path d={`M ${printArea.x} ${printArea.y + 10} L ${printArea.x} ${printArea.y} L ${printArea.x + 10} ${printArea.y}`} stroke="#00871f" strokeWidth="2.5" fill="none" />
            <path d={`M ${printArea.x + printArea.width - 10} ${printArea.y} L ${printArea.x + printArea.width} ${printArea.y} L ${printArea.x + printArea.width} ${printArea.y + 10}`} stroke="#00871f" strokeWidth="2.5" fill="none" />
            <path d={`M ${printArea.x} ${printArea.y + printArea.height - 10} L ${printArea.x} ${printArea.y + printArea.height} L ${printArea.x + 10} ${printArea.y + printArea.height}`} stroke="#00871f" strokeWidth="2.5" fill="none" />
            <path d={`M ${printArea.x + printArea.width - 10} ${printArea.y + printArea.height} L ${printArea.x + printArea.width} ${printArea.y + printArea.height} L ${printArea.x + printArea.width} ${printArea.y + printArea.height - 10}`} stroke="#00871f" strokeWidth="2.5" fill="none" />
            {/* Label Badge */}
            <text
              x={printArea.x + printArea.width / 2}
              y={printArea.y + printArea.height + 14}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="#00871f"
            >
              {printArea.label}
            </text>
          </g>
        )}

        {/* =========================================================================
            8. RENDER DESIGN ELEMENTS (TEXT / IMAGE / CLIP ART)
        ========================================================================= */}
        {currentAngleElements.map((el) => {
          // Calculate absolute pixel in SVG space based on print area
          const posX = printArea.x + (el.x / 100) * printArea.width;
          const posY = printArea.y + (el.y / 100) * printArea.height;
          const isSelected = selectedElementId === el.id;

          return (
            <g
              key={el.id}
              transform={`translate(${posX}, ${posY}) rotate(${el.rotation}) scale(${el.scale})`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectElement) onSelectElement(el.id);
              }}
              className="cursor-move group"
            >
              {/* If Text */}
              {el.type === 'text' && (
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={el.fill || '#111827'}
                  fontFamily={el.fontFamily || 'Impact, sans-serif'}
                  fontSize={el.fontSize || 24}
                  fontWeight={el.fontWeight || 'bold'}
                  fontStyle={el.fontStyle || 'normal'}
                  style={{
                    letterSpacing: `${el.letterSpacing || 1}px`,
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}
                >
                  {el.text || 'ATHREE JAYAPURA'}
                </text>
              )}

              {/* If Image */}
              {el.type === 'image' && el.src && (
                <image
                  href={el.src}
                  x={-(el.width / 2)}
                  y={-(el.height / 2)}
                  width={el.width}
                  height={el.height}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}

              {/* If Clipart */}
              {el.type === 'clipart' && (
                <g transform="translate(-30, -30)">
                  {renderVectorClipart(el.clipartName || 'star', el.fill || '#111827')}
                </g>
              )}

              {/* Selection Bounding Box */}
              {isSelected && !isExporting && (
                <rect
                  x={-(el.width ? el.width / 2 + 6 : 40)}
                  y={-(el.height ? el.height / 2 + 6 : 25)}
                  width={el.width ? el.width + 12 : 80}
                  height={el.height ? el.height + 12 : 50}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  rx="3"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Vector clipart icon renderer
function renderVectorClipart(name: string, fill: string) {
  switch (name) {
    case 'star':
      return (
        <svg viewBox="0 0 60 60" width="60" height="60">
          <polygon
            points="30,5 37.5,22 55,22 41,33 46,50 30,39 14,50 19,33 5,22 22.5,22"
            fill={fill}
          />
        </svg>
      );
    case 'jayapura':
      return (
        <svg viewBox="0 0 60 60" width="60" height="60">
          <circle cx="30" cy="30" r="26" fill="none" stroke={fill} strokeWidth="3" />
          <path d="M 12 35 C 22 20, 38 20, 48 35" stroke={fill} strokeWidth="3" fill="none" />
          <path d="M 30 14 L 30 46" stroke={fill} strokeWidth="3" />
          <text x="30" y="54" textAnchor="middle" fontSize="7" fontWeight="bold" fill={fill}>
            JAYAPURA
          </text>
        </svg>
      );
    case 'sport-shield':
      return (
        <svg viewBox="0 0 60 60" width="60" height="60">
          <path
            d="M 30 6 L 50 14 C 50 38, 30 54, 30 54 C 30 54, 10 38, 10 14 Z"
            fill={fill}
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <polygon points="30,16 34,26 44,26 36,32 39,42 30,36 21,42 24,32 16,26 26,26" fill="#FFFFFF" />
        </svg>
      );
    case 'flame':
      return (
        <svg viewBox="0 0 60 60" width="60" height="60">
          <path
            d="M 30 5 C 32 18, 48 24, 48 40 C 48 50, 40 56, 30 56 C 20 56, 12 50, 12 40 C 12 28, 22 22, 26 14 C 27 22, 34 26, 30 5 Z"
            fill={fill}
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 60 60" width="60" height="60">
          <circle cx="30" cy="30" r="24" fill={fill} />
        </svg>
      );
  }
}
