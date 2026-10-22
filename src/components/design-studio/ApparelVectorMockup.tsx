import React, { useState } from 'react';
import { ProductType, ViewAngle, DesignElement } from './designStudioTypes';

/**
 * Returns the authentic New States Apparel high-resolution catalog product image
 * corresponding to the user-uploaded sample images (Hitam, Merah Cabe, Kuning Kenari).
 */
export const getTshirtPhotoUrl = (hex?: string, name?: string): string | null => {
  const normalizedHex = (hex || '').toLowerCase().trim();
  const normalizedName = (name || '').toLowerCase().trim();

  // 1. Black / Hitam -> image_0b44b9c3.png (User sample)
  if (
    normalizedHex === '#161616' ||
    normalizedHex === '#111111' ||
    normalizedHex === '#121212' ||
    normalizedHex === '#1e1e1e' ||
    normalizedHex === '#000000' ||
    normalizedHex === '#2b323d' ||
    normalizedName.includes('hitam') ||
    normalizedName.includes('black')
  ) {
    return '/assets/aistudio/image_0b44b9c3.png';
  }

  // 2. Red / Merah Cabe -> image_39dbbc7d.png (User sample)
  if (
    normalizedHex === '#de1b23' ||
    normalizedHex === '#df2027' ||
    normalizedHex === '#dc2626' ||
    normalizedHex === '#e11d2a' ||
    normalizedHex === '#ff0000' ||
    normalizedName.includes('merah') ||
    normalizedName.includes('red')
  ) {
    return '/assets/aistudio/image_39dbbc7d.png';
  }

  // 3. Yellow / Kuning Kenari -> image_c8915628.png (User sample)
  if (
    normalizedHex === '#fdc82f' ||
    normalizedHex === '#fdca3a' ||
    normalizedHex === '#facc15' ||
    normalizedHex === '#ffff00' ||
    normalizedName.includes('kuning') ||
    normalizedName.includes('yellow')
  ) {
    return '/assets/aistudio/image_c8915628.png';
  }

  return null;
};

interface ApparelVectorMockupProps {
  productType: ProductType;
  colorHex: string;
  colorName?: string;
  imageMockupUrl?: string;
  mockupMode?: 'auto' | 'photo' | 'vector';
  angle: ViewAngle;
  showPrintAreaGuide?: boolean;
  elements?: DesignElement[];
  onSelectElement?: (id: string | null) => void;
  selectedElementId?: string | null;
  onUpdateElementPosition?: (id: string, x: number, y: number) => void;
  onUpdateElementSize?: (id: string, width: number, height: number) => void;
  onUpdateElement?: (id: string, updates: Partial<DesignElement>) => void;
  onDeleteElement?: (id: string) => void;
  isExporting?: boolean;
  scale?: number;
  selectedSize?: string;
  showGarmentMeasurements?: boolean;
  isScale1to1?: boolean;
}

export const ApparelVectorMockup: React.FC<ApparelVectorMockupProps> = ({
  productType,
  colorHex,
  colorName,
  imageMockupUrl,
  mockupMode = 'auto',
  angle,
  showPrintAreaGuide = true,
  elements = [],
  onSelectElement,
  selectedElementId,
  onUpdateElementPosition,
  onUpdateElementSize,
  onUpdateElement,
  onDeleteElement,
  isExporting = false,
  scale = 1,
  selectedSize = 'M',
  showGarmentMeasurements = false,
  isScale1to1 = false
}) => {
  // Elements active for current angle
  const currentAngleElements = elements.filter((el) => el.angle === angle);

  // Mouse Drag & Resize State
  const [dragState, setDragState] = useState<{
    elementId: string;
    mode: 'move' | 'resize-br' | 'resize-bl' | 'resize-tr' | 'resize-tl';
    startX: number;
    startY: number;
    initialElemX: number;
    initialElemY: number;
    initialWidth: number;
    initialHeight: number;
  } | null>(null);

  // Size measurement mapping (LD, P, L in cm) matching Image 5
  const SIZE_DIMENSIONS: Record<string, { ld: number; p: number; l: number }> = {
    'S': { ld: 47, p: 67, l: 19 },
    'M': { ld: 50, p: 70, l: 19.5 },
    'L': { ld: 53, p: 73, l: 20 },
    'XL': { ld: 56, p: 75, l: 20.5 },
    '2XL': { ld: 59, p: 77, l: 21 },
    '3XL': { ld: 62, p: 80, l: 21.5 },
    '4XL': { ld: 65, p: 83, l: 22 },
    '5XL': { ld: 68, p: 86, l: 22.5 }
  };
  const currentDim = SIZE_DIMENSIONS[selectedSize] || SIZE_DIMENSIONS['M'];

  // Determine printable area coordinates (x, y, width, height in SVG viewbox units 0-500 x 0-600)
  // Perfectly centered horizontally on the garment (SVG center is X = 250)
  const getPrintArea = () => {
    switch (angle) {
      case 'depan':
        if (productType === 'hoodie') {
          return { x: 175, y: 160, width: 150, height: 140, label: 'Area Sablon Dada Tengah (28 × 26 cm)' };
        }
        if (productType === 'polo') {
          return { x: 165, y: 185, width: 170, height: 215, label: 'Area Cetak Tengah Bordir / DTF' };
        }
        // tshirt & jersey: 180 width centered at 250 -> x = 160 (160 + 90 = 250)
        return { x: 160, y: 145, width: 180, height: 255, label: 'Area Cetak A3 Tengah (30 × 42 cm)' };
      case 'belakang':
        return { x: 160, y: 135, width: 180, height: 255, label: 'Area Cetak Punggung Tengah (30 × 42 cm)' };
      case 'lengan-kiri':
      case 'lengan-kanan':
        return { x: 180, y: 160, width: 140, height: 160, label: 'Area Cetak Lengan (10 × 12 cm)' };
      case 'label':
        return { x: 160, y: 200, width: 180, height: 150, label: 'Area Sablon Label Kerah (6 × 6 cm)' };
      default:
        return { x: 160, y: 145, width: 180, height: 255, label: 'Area Cetak Tengah' };
    }
  };

  const printArea = getPrintArea();

  // Reference collar / neckline Y for calculating distance to collar
  const getCollarY = () => {
    switch (angle) {
      case 'depan':
        if (productType === 'hoodie') return 145;
        if (productType === 'polo') return 140;
        return 115; // crewneck collar bottom
      case 'belakang':
        return 80; // back collar seam
      case 'lengan-kiri':
      case 'lengan-kanan':
        return 135;
      case 'label':
        return 140;
      default:
        return 115;
    }
  };

  // Active or selected element for real-time measurements
  const selectedEl =
    currentAngleElements.find((el) => el.id === selectedElementId) ||
    (currentAngleElements.length === 1 ? currentAngleElements[0] : null);

  const collarY = getCollarY();

  // Real-time distance measurements: collar, left, and right
  let selectedElStats: {
    id: string;
    posX: number;
    posY: number;
    elW: number;
    elH: number;
    halfW: number;
    halfH: number;
    objTopY: number;
    objBottomY: number;
    objLeftX: number;
    objRightX: number;
    collarY: number;
    distCollarCm: number;
    distLeftCm: number;
    distRightCm: number;
    isCenteredX: boolean;
  } | null = null;

  if (selectedEl) {
    const posX = printArea.x + (selectedEl.x / 100) * printArea.width;
    const posY = printArea.y + (selectedEl.y / 100) * printArea.height;
    const elW = selectedEl.width || 80;
    const elH = selectedEl.height || 80;
    const halfW = elW / 2;
    const halfH = elH / 2;
    const objTopY = posY - halfH;
    const objBottomY = posY + halfH;
    const objLeftX = posX - halfW;
    const objRightX = posX + halfW;

    // Standard A3 area: 30cm width x 42cm height
    const cmPerSvgX = 30 / printArea.width;
    const cmPerSvgY = 42 / printArea.height;

    const distCollarSvg = Math.max(0, objTopY - collarY);
    const distCollarCm = Math.round(distCollarSvg * cmPerSvgY * 10) / 10;

    const distLeftSvg = Math.max(0, objLeftX - printArea.x);
    const distLeftCm = Math.round(distLeftSvg * cmPerSvgX * 10) / 10;

    const distRightSvg = Math.max(0, (printArea.x + printArea.width) - objRightX);
    const distRightCm = Math.round(distRightSvg * cmPerSvgX * 10) / 10;

    const isCenteredX = Math.abs(posX - 250) <= 2;

    selectedElStats = {
      id: selectedEl.id,
      posX,
      posY,
      elW,
      elH,
      halfW,
      halfH,
      objTopY,
      objBottomY,
      objLeftX,
      objRightX,
      collarY,
      distCollarCm,
      distLeftCm,
      distRightCm,
      isCenteredX
    };
  }

  const handleElementMouseDown = (e: React.MouseEvent, el: DesignElement) => {
    e.stopPropagation();
    if (onSelectElement) onSelectElement(el.id);

    setDragState({
      elementId: el.id,
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      initialElemX: el.x,
      initialElemY: el.y,
      initialWidth: el.width || 80,
      initialHeight: el.height || 80
    });
  };

  const handleHandleMouseDown = (
    e: React.MouseEvent,
    el: DesignElement,
    mode: 'resize-br' | 'resize-bl' | 'resize-tr' | 'resize-tl'
  ) => {
    e.stopPropagation();
    setDragState({
      elementId: el.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialElemX: el.x,
      initialElemY: el.y,
      initialWidth: el.width || 80,
      initialHeight: el.height || 80
    });
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    const dx = (e.clientX - dragState.startX) / (scale || 1);
    const dy = (e.clientY - dragState.startY) / (scale || 1);

    if (dragState.mode === 'move') {
      const deltaXPercent = (dx / printArea.width) * 100;
      const deltaYPercent = (dy / printArea.height) * 100;
      const newX = Math.max(5, Math.min(95, Math.round(dragState.initialElemX + deltaXPercent)));
      const newY = Math.max(5, Math.min(95, Math.round(dragState.initialElemY + deltaYPercent)));
      if (onUpdateElementPosition) {
        onUpdateElementPosition(dragState.elementId, newX, newY);
      } else if (onUpdateElement) {
        onUpdateElement(dragState.elementId, { x: newX, y: newY });
      }
    } else {
      let newW = dragState.initialWidth;
      let newH = dragState.initialHeight;
      const currentEl = elements.find((el) => el.id === dragState.elementId);
      const isImg = currentEl?.type === 'image';
      const aspect = dragState.initialWidth / (dragState.initialHeight || 1);

      if (dragState.mode === 'resize-br') {
        newW = Math.max(25, Math.min(printArea.width * 1.3, dragState.initialWidth + dx * 2));
        newH = isImg ? newW / aspect : Math.max(25, Math.min(printArea.height * 1.3, dragState.initialHeight + dy * 2));
      } else if (dragState.mode === 'resize-bl') {
        newW = Math.max(25, Math.min(printArea.width * 1.3, dragState.initialWidth - dx * 2));
        newH = isImg ? newW / aspect : Math.max(25, Math.min(printArea.height * 1.3, dragState.initialHeight + dy * 2));
      } else if (dragState.mode === 'resize-tr') {
        newW = Math.max(25, Math.min(printArea.width * 1.3, dragState.initialWidth + dx * 2));
        newH = isImg ? newW / aspect : Math.max(25, Math.min(printArea.height * 1.3, dragState.initialHeight - dy * 2));
      } else if (dragState.mode === 'resize-tl') {
        newW = Math.max(25, Math.min(printArea.width * 1.3, dragState.initialWidth - dx * 2));
        newH = isImg ? newW / aspect : Math.max(25, Math.min(printArea.height * 1.3, dragState.initialHeight - dy * 2));
      }

      if (onUpdateElementSize) {
        onUpdateElementSize(dragState.elementId, Math.round(newW), Math.round(newH));
      } else if (onUpdateElement) {
        onUpdateElement(dragState.elementId, { width: Math.round(newW), height: Math.round(newH) });
      }
    }
  };

  const handleContainerMouseUp = () => {
    setDragState(null);
  };

  // Determine if high-res real catalog photo is available for current garment & color
  const activePhotoUrl =
    productType === 'tshirt' && angle === 'depan'
      ? imageMockupUrl || getTshirtPhotoUrl(colorHex, colorName)
      : null;

  return (
    <div
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      className="relative w-full h-full flex items-center justify-center select-none overflow-hidden"
    >
      <svg
        id="apparel-mockup-svg"
        viewBox="0 0 500 600"
        className="w-full h-full max-h-[580px] transition-all duration-200"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        <defs>
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
            {activePhotoUrl && mockupMode !== 'vector' ? (
              /* Authentic High-Resolution Catalog Product Photo (NSA 7200) matching user sample images */
              <image
                href={activePhotoUrl}
                x="20"
                y="15"
                width="460"
                height="545"
                preserveAspectRatio="xMidYMid meet"
                className="pointer-events-none select-none"
              />
            ) : (
              /* Clean Flat Solid Color Vector Mockup - Zero artificial shadows, zero lighting/glare */
              <g id="tshirt-front-vector">
                {/* Inner Back Neck Collar Opening (Solid Clean Color, No Artificial Shadow) */}
                <path
                  d="M 175 75 C 210 58, 290 58, 325 75 C 295 105, 205 105, 175 75 Z"
                  fill={colorHex}
                />

                {/* Woven Neck Label Tag inside the collar (matching sample images) */}
                <g id="neck-label-tag">
                  <rect x="238" y="68" width="24" height="22" rx="1.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
                  <rect x="240" y="70.5" width="20" height="2" fill="#0284C7" />
                  <text x="250" y="78.5" textAnchor="middle" fontSize="2.8" fontWeight="bold" fill="#0F172A" letterSpacing="0.2">NEW STATES</text>
                  <text x="250" y="82" textAnchor="middle" fontSize="2.4" fontWeight="bold" fill="#0284C7">APPAREL</text>
                  <text x="250" y="86.5" textAnchor="middle" fontSize="2.8" fontWeight="bold" fill="#64748B">{selectedSize || 'M'}</text>
                </g>

                {/* Base Body & Sleeves (Solid Clean Color, 100% Flat & Clean without artificial shadow/glare) */}
                <path
                  d="M 175 75 
                     C 205 105, 295 105, 325 75 
                     C 355 85, 390 95, 410 105 
                     C 435 140, 455 175, 462 188 
                     L 398 232 
                     C 385 215, 375 205, 368 198 
                     L 368 522 
                     C 368 532, 132 532, 132 522 
                     L 132 198 
                     C 125 205, 115 215, 102 232 
                     L 38 188 
                     C 45 175, 65 140, 90 105 
                     C 110 95, 145 85, 175 75 
                     Z"
                  fill={colorHex}
                  stroke="#000000"
                  strokeOpacity="0.12"
                  strokeWidth="1"
                />

                {/* Front Collar Ribbing (Crewneck 1:1) in Solid Clean Color */}
                <path
                  d="M 175 75 C 205 118, 295 118, 325 75 C 295 98, 205 98, 175 75 Z"
                  fill={colorHex}
                  stroke="#000000"
                  strokeOpacity="0.15"
                  strokeWidth="1"
                />
                {/* Fine Rib Texture on Collar */}
                <path
                  d="M 178 77 C 206 116, 294 116, 322 77"
                  stroke="#000000"
                  strokeOpacity="0.08"
                  strokeWidth="0.8"
                  fill="none"
                />

                {/* Sleeve Seams */}
                <path d="M 132 198 C 137 150, 150 110, 175 75" stroke="#000000" strokeOpacity="0.1" strokeWidth="1" fill="none" />
                <path d="M 368 198 C 363 150, 350 110, 325 75" stroke="#000000" strokeOpacity="0.1" strokeWidth="1" fill="none" />

                {/* Sleeve Hem lines */}
                <line x1="40" y1="186" x2="100" y2="230" stroke="#000000" strokeOpacity="0.1" strokeWidth="0.8" />
                <line x1="38" y1="190" x2="98" y2="234" stroke="#000000" strokeOpacity="0.08" strokeWidth="0.7" strokeDasharray="3,2" />
                <line x1="460" y1="186" x2="400" y2="230" stroke="#000000" strokeOpacity="0.1" strokeWidth="0.8" />
                <line x1="462" y1="190" x2="402" y2="234" stroke="#000000" strokeOpacity="0.08" strokeWidth="0.7" strokeDasharray="3,2" />

                {/* Bottom Hem Double Stitch */}
                <path d="M 132 516 C 200 522, 300 522, 368 516" stroke="#000000" strokeOpacity="0.12" strokeWidth="0.8" fill="none" />
                <path d="M 132 520 C 200 526, 300 526, 368 520" stroke="#000000" strokeOpacity="0.08" strokeWidth="0.7" fill="none" strokeDasharray="3,2" />
              </g>
            )}
          </g>
        )}

        {productType === 'tshirt' && angle === 'belakang' && (
          <g id="tshirt-back">
            {/* Base Body & Sleeves (Solid Clean Color, 100% Flat & Clean without artificial shadow/glare) */}
            <path
              d="M 175 70 
                 C 210 82, 290 82, 325 70 
                 C 355 85, 390 95, 410 105 
                 C 435 140, 455 175, 462 188 
                 L 398 232 
                 C 385 215, 375 205, 368 198 
                 L 368 522 
                 C 368 532, 132 532, 132 522 
                 L 132 198 
                 C 125 205, 115 215, 102 232 
                 L 38 188 
                 C 45 175, 65 140, 90 105 
                 C 110 95, 145 85, 175 70 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.12"
              strokeWidth="1"
            />
            {/* Back Collar Band */}
            <path
              d="M 175 70 C 210 82, 290 82, 325 70 C 310 64, 190 64, 175 70 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
            {/* Half Moon / Yoke Stitches */}
            <path d="M 175 75 C 210 115, 290 115, 325 75" stroke="#000000" strokeOpacity="0.1" strokeWidth="0.8" fill="none" strokeDasharray="3,2" />
            <path d="M 132 198 C 137 150, 150 110, 175 70" stroke="#000000" strokeOpacity="0.1" strokeWidth="1" fill="none" />
            <path d="M 368 198 C 363 150, 350 110, 325 70" stroke="#000000" strokeOpacity="0.1" strokeWidth="1" fill="none" />
            <path d="M 132 516 C 200 522, 300 522, 368 516" stroke="#000000" strokeOpacity="0.12" strokeWidth="0.8" fill="none" />
            <path d="M 132 520 C 200 526, 300 526, 368 520" stroke="#000000" strokeOpacity="0.08" strokeWidth="0.7" fill="none" strokeDasharray="3,2" />
          </g>
        )}

        {/* =========================================================================
            2. POLO T-SHIRT (FRONT / BACK)
        ========================================================================= */}
        {productType === 'polo' && angle === 'depan' && (
          <g id="polo-front">
            {/* Polo Body in Solid Clean Color */}
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
              strokeOpacity="0.2"
              strokeWidth="1.2"
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
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.2"
              strokeWidth="1"
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
              strokeOpacity="0.25"
              strokeWidth="1.2"
            />
            {/* Placket Reinforced Bottom Box */}
            <rect x="236" y="180" width="28" height="20" fill={colorHex} stroke="#000000" strokeOpacity="0.2" strokeWidth="1" />
            <line x1="236" y1="180" x2="264" y2="200" stroke="#000000" strokeOpacity="0.15" strokeWidth="0.8" />
            <line x1="264" y1="180" x2="236" y2="200" stroke="#000000" strokeOpacity="0.15" strokeWidth="0.8" />

            {/* 3 Buttons */}
            <circle cx="250" cy="120" r="4" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />
            <circle cx="250" cy="145" r="4" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />
            <circle cx="250" cy="170" r="4" fill="#E5E7EB" stroke="#6B7280" strokeWidth="1" />

            {/* Cuffed Sleeve Ribbing */}
            <path d="M 52 188 L 103 223" stroke="#000000" strokeOpacity="0.2" strokeWidth="2.5" />
            <path d="M 448 188 L 397 223" stroke="#000000" strokeOpacity="0.2" strokeWidth="2.5" />
          </g>
        )}

        {productType === 'polo' && angle === 'belakang' && (
          <g id="polo-back">
            <path
              d="M 175 70 C 210 80, 290 80, 325 70 L 405 105 L 450 190 L 395 225 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 105 225 L 50 190 L 95 105 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.2"
              strokeWidth="1.2"
            />
            {/* Back Collar Turned Down */}
            <path
              d="M 170 65 C 215 55, 285 55, 330 65 L 325 85 C 290 75, 210 75, 175 85 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.2"
            />
          </g>
        )}

        {/* =========================================================================
            3. HOODIE (JACKET & HOODIES)
        ========================================================================= */}
        {productType === 'hoodie' && angle === 'depan' && (
          <g id="hoodie-front">
            {/* Hoodie Body in Solid Clean Color */}
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
              strokeOpacity="0.2"
              strokeWidth="1.2"
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
              strokeOpacity="0.25"
              strokeWidth="1.2"
            />
            <path
              d="M 175 80 C 195 45, 230 40, 250 40 C 270 40, 305 45, 325 80 C 295 115, 205 115, 175 80 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.2"
              strokeWidth="1"
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
              strokeOpacity="0.25"
              strokeWidth="1.2"
            />
            {/* Pocket Slanted Hand Openings */}
            <path d="M 165 340 L 140 430" stroke="#000000" strokeOpacity="0.2" strokeWidth="1.5" />
            <path d="M 335 340 L 360 430" stroke="#000000" strokeOpacity="0.2" strokeWidth="1.5" />

            {/* Ribbed Bottom Waistband */}
            <rect x="120" y="500" width="260" height="30" fill={colorHex} stroke="#000000" strokeOpacity="0.2" strokeWidth="1" />
            {/* Sleeve Ribbed Cuffs */}
            <path d="M 32 238 L 92 268" stroke="#000000" strokeOpacity="0.2" strokeWidth="3" />
            <path d="M 468 238 L 408 268" stroke="#000000" strokeOpacity="0.2" strokeWidth="3" />
          </g>
        )}

        {productType === 'hoodie' && angle === 'belakang' && (
          <g id="hoodie-back">
            <path
              d="M 160 80 C 195 95, 305 95, 340 80 L 420 115 L 470 240 L 410 270 L 380 230 L 380 530 L 120 530 L 120 230 L 90 270 L 30 240 L 80 115 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.2"
              strokeWidth="1.2"
            />
            {/* Hanging Hood on Back */}
            <path
              d="M 160 80 
                 C 140 160, 210 210, 250 210 
                 C 290 210, 360 160, 340 80 
                 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.2"
            />
            <rect x="120" y="500" width="260" height="30" fill={colorHex} stroke="#000000" strokeOpacity="0.2" strokeWidth="1" />
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
              strokeOpacity="0.2"
              strokeWidth="1.2"
            />
            {/* Athletic Sport Mesh Overlay */}
            <path
              d="M 180 75 C 205 100, 295 100, 320 75 L 410 105 L 465 185 L 400 230 L 370 195 L 370 520 C 370 535, 130 535, 130 520 L 130 195 L 100 230 L 35 185 L 90 105 Z"
              fill="url(#meshPattern)"
            />

            {/* Sport Raglan Seams (Bahu ke Ketiak) */}
            <path d="M 180 75 C 160 120, 140 160, 130 195" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4,2" fill="none" />
            <path d="M 320 75 C 340 120, 360 160, 370 195" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4,2" fill="none" />

            {/* Dynamic Sport Side Breathable Stripes */}
            <path d="M 130 220 L 145 520" stroke="#000000" strokeOpacity="0.08" strokeWidth="8" fill="none" />
            <path d="M 370 220 L 355 520" stroke="#000000" strokeOpacity="0.08" strokeWidth="8" fill="none" />

            {/* V-insert / Modern Crew Collar */}
            <path
              d="M 180 75 C 205 110, 295 110, 320 75 C 290 92, 210 92, 180 75 Z"
              fill={colorHex}
              stroke="#000000"
              strokeOpacity="0.25"
              strokeWidth="1.2"
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
              strokeOpacity="0.2"
              strokeWidth="1.2"
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
              strokeOpacity="0.2"
              strokeWidth="1.5"
            />
            {/* Shoulder Seam Arc */}
            <path d="M 170 80 C 250 110, 330 80, 330 80" stroke="#000000" strokeOpacity="0.2" strokeWidth="1.5" fill="none" />
            {/* Sleeve Hem Line */}
            <path d="M 140 370 L 360 370" stroke="#000000" strokeOpacity="0.2" strokeWidth="1.2" strokeDasharray="3,2" />
          </g>
        )}

        {/* =========================================================================
            6. LABEL VIEW (INSIDE COLLAR / PRINT LABEL)
        ========================================================================= */}
        {angle === 'label' && (
          <g id="label-view">
            {/* Collar Inside Zoom */}
            <rect x="75" y="60" width="350" height="480" rx="20" fill={colorHex} stroke="#000000" strokeOpacity="0.15" strokeWidth="1.2" />
            {/* Collar Rib Curved Band */}
            <path d="M 75 140 C 180 220, 320 220, 425 140" stroke="#000000" strokeOpacity="0.2" strokeWidth="18" fill="none" />
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
            7. GARMENT MEASUREMENT GUIDE (LD, P, L) & REAL 1:1 RULERS (Matching Images)
        ========================================================================= */}
        {showGarmentMeasurements && !isExporting && (
          <g id="garment-measurement-guide" className="pointer-events-none animate-in fade-in duration-150">
            {/* LD (Lebar Dada) Measurement Line */}
            <line x1="130" y1="280" x2="370" y2="280" stroke="#00871f" strokeWidth="2" strokeDasharray="4,3" />
            <polygon points="130,280 138,276 138,284" fill="#00871f" />
            <polygon points="370,280 362,276 362,284" fill="#00871f" />
            <rect x="210" y="268" width="80" height="22" rx="6" fill="#FFFFFF" stroke="#00871f" strokeWidth="1.5" />
            <text x="250" y="283" textAnchor="middle" fill="#00871f" fontSize="10.5" fontWeight="bold">
              LD: {currentDim.ld} cm
            </text>

            {/* P (Panjang) Measurement Line */}
            <line x1="175" y1="75" x2="175" y2="520" stroke="#2563EB" strokeWidth="2" strokeDasharray="4,3" />
            <polygon points="175,75 171,83 179,83" fill="#2563EB" />
            <polygon points="175,520 171,512 179,512" fill="#2563EB" />
            <rect x="142" y="295" width="66" height="22" rx="6" fill="#FFFFFF" stroke="#2563EB" strokeWidth="1.5" />
            <text x="175" y="310" textAnchor="middle" fill="#2563EB" fontSize="10.5" fontWeight="bold">
              P: {currentDim.p} cm
            </text>

            {/* L (Lengan) Measurement Line */}
            <line x1="95" y1="105" x2="40" y2="185" stroke="#D97706" strokeWidth="2" strokeDasharray="4,3" />
            <polygon points="95,105 91,114 99,112" fill="#D97706" />
            <polygon points="40,185 46,177 42,173" fill="#D97706" />
            <rect x="25" y="130" width="70" height="22" rx="6" fill="#FFFFFF" stroke="#D97706" strokeWidth="1.5" />
            <text x="60" y="145" textAnchor="middle" fill="#D97706" fontSize="10.5" fontWeight="bold">
              L: {currentDim.l} cm
            </text>
          </g>
        )}

        {/* Real 1:1 Centimeter Rulers */}
        {isScale1to1 && !isExporting && (
          <g id="scale-1to1-rulers" className="pointer-events-none">
            {/* Top Horizontal Centimeter Ruler (0 to 50 cm) */}
            <rect x="0" y="0" width="500" height="18" fill="rgba(248, 250, 252, 0.95)" stroke="#CBD5E1" strokeWidth="1" />
            {Array.from({ length: 26 }).map((_, i) => {
              const cmVal = i * 2;
              const xPos = 40 + (i / 25) * 420;
              return (
                <g key={`ruler-top-${i}`}>
                  <line x1={xPos} y1="0" x2={xPos} y2="10" stroke="#64748B" strokeWidth={i % 5 === 0 ? 1.5 : 0.8} />
                  {i % 5 === 0 && (
                    <text x={xPos} y="16" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#334155">
                      {cmVal}
                    </text>
                  )}
                </g>
              );
            })}
            <text x="250" y="8" textAnchor="middle" fontSize="6.5" fontWeight="extrabold" fill="#00871f">
              SKALA 1:1 REAL SIZE (CM)
            </text>

            {/* Left Vertical Centimeter Ruler (0 to 60 cm) */}
            <rect x="0" y="0" width="18" height="600" fill="rgba(248, 250, 252, 0.95)" stroke="#CBD5E1" strokeWidth="1" />
            {Array.from({ length: 31 }).map((_, i) => {
              const cmVal = i * 2;
              const yPos = 30 + (i / 30) * 540;
              return (
                <g key={`ruler-left-${i}`}>
                  <line x1="0" y1={yPos} x2="10" y2={yPos} stroke="#64748B" strokeWidth={i % 5 === 0 ? 1.5 : 0.8} />
                  {i % 5 === 0 && (
                    <text x="15" y={yPos + 2.5} textAnchor="end" fontSize="6" fontWeight="bold" fill="#334155">
                      {cmVal}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* =========================================================================
            8. PRINTABLE AREA BOUNDARY (AREA CETAK 1:1 DI TENGAH BAJU)
        ========================================================================= */}
        {showPrintAreaGuide && !isExporting && (
          <g id="printable-area-guide">
            {/* Center Registration Notch Top & Bottom */}
            <line
              x1="250"
              y1={printArea.y - 7}
              x2="250"
              y2={printArea.y + 7}
              stroke="#00871f"
              strokeWidth="2"
            />
            <line
              x1="250"
              y1={printArea.y + printArea.height - 7}
              x2="250"
              y2={printArea.y + printArea.height + 7}
              stroke="#00871f"
              strokeWidth="2"
            />

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
              y={printArea.y + printArea.height + 13}
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
            8B. REAL-TIME DISTANCE MEASUREMENTS (JARAK KERAH, KIRI, KANAN)
        ========================================================================= */}
        {showPrintAreaGuide && !isExporting && selectedElStats && (
          <g id="object-distance-guidelines" className="pointer-events-none">
            {/* Centerline down the shirt (X = 250) */}
            <line
              x1="250"
              y1={printArea.y - 12}
              x2="250"
              y2={printArea.y + printArea.height + 14}
              stroke={selectedElStats.isCenteredX ? '#059669' : '#94A3B8'}
              strokeWidth={selectedElStats.isCenteredX ? '1.8' : '1'}
              strokeDasharray={selectedElStats.isCenteredX ? 'none' : '4,4'}
              strokeOpacity="0.75"
            />

            {/* 1. Distance to Collar (Jarak ke Kerah) */}
            <g id="guide-collar-distance">
              <line
                x1={selectedElStats.posX}
                y1={selectedElStats.collarY}
                x2={selectedElStats.posX}
                y2={selectedElStats.objTopY}
                stroke="#2563EB"
                strokeWidth="1.8"
                strokeDasharray="4,3"
              />
              {/* End Ticks */}
              <line
                x1={selectedElStats.posX - 10}
                y1={selectedElStats.collarY}
                x2={selectedElStats.posX + 10}
                y2={selectedElStats.collarY}
                stroke="#2563EB"
                strokeWidth="2.5"
              />
              <line
                x1={selectedElStats.posX - 10}
                y1={selectedElStats.objTopY}
                x2={selectedElStats.posX + 10}
                y2={selectedElStats.objTopY}
                stroke="#2563EB"
                strokeWidth="2.5"
              />
              {/* Badge */}
              <g
                transform={`translate(${selectedElStats.posX}, ${
                  selectedElStats.objTopY - selectedElStats.collarY > 24
                    ? (selectedElStats.collarY + selectedElStats.objTopY) / 2
                    : Math.max(selectedElStats.collarY - 14, 95)
                })`}
              >
                <rect
                  x="-46"
                  y="-10"
                  width="92"
                  height="20"
                  rx="5"
                  fill="#1E293B"
                  stroke="#3B82F6"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  Kerah: {selectedElStats.distCollarCm} cm
                </text>
              </g>
            </g>

            {/* 2. Distance to Left Border (Jarak ke Sisi Kiri) */}
            <g id="guide-left-distance">
              <line
                x1={printArea.x}
                y1={selectedElStats.posY}
                x2={selectedElStats.objLeftX}
                y2={selectedElStats.posY}
                stroke="#0284C7"
                strokeWidth="1.8"
                strokeDasharray="4,3"
              />
              <line
                x1={printArea.x}
                y1={selectedElStats.posY - 8}
                x2={printArea.x}
                y2={selectedElStats.posY + 8}
                stroke="#0284C7"
                strokeWidth="2.5"
              />
              <line
                x1={selectedElStats.objLeftX}
                y1={selectedElStats.posY - 8}
                x2={selectedElStats.objLeftX}
                y2={selectedElStats.posY + 8}
                stroke="#0284C7"
                strokeWidth="2.5"
              />
              {/* Badge */}
              <g
                transform={`translate(${
                  (printArea.x + selectedElStats.objLeftX) / 2
                }, ${selectedElStats.posY - 12})`}
              >
                <rect
                  x="-36"
                  y="-9"
                  width="72"
                  height="18"
                  rx="4"
                  fill="#0F172A"
                  stroke="#38BDF8"
                  strokeWidth="1.3"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#38BDF8"
                  fontSize="9"
                  fontWeight="bold"
                >
                  Kiri: {selectedElStats.distLeftCm} cm
                </text>
              </g>
            </g>

            {/* 3. Distance to Right Border (Jarak ke Sisi Kanan) */}
            <g id="guide-right-distance">
              <line
                x1={selectedElStats.objRightX}
                y1={selectedElStats.posY}
                x2={printArea.x + printArea.width}
                y2={selectedElStats.posY}
                stroke="#0284C7"
                strokeWidth="1.8"
                strokeDasharray="4,3"
              />
              <line
                x1={selectedElStats.objRightX}
                y1={selectedElStats.posY - 8}
                x2={selectedElStats.objRightX}
                y2={selectedElStats.posY + 8}
                stroke="#0284C7"
                strokeWidth="2.5"
              />
              <line
                x1={printArea.x + printArea.width}
                y1={selectedElStats.posY - 8}
                x2={printArea.x + printArea.width}
                y2={selectedElStats.posY + 8}
                stroke="#0284C7"
                strokeWidth="2.5"
              />
              {/* Badge */}
              <g
                transform={`translate(${
                  (selectedElStats.objRightX + printArea.x + printArea.width) / 2
                }, ${selectedElStats.posY - 12})`}
              >
                <rect
                  x="-36"
                  y="-9"
                  width="72"
                  height="18"
                  rx="4"
                  fill="#0F172A"
                  stroke="#38BDF8"
                  strokeWidth="1.3"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#38BDF8"
                  fontSize="9"
                  fontWeight="bold"
                >
                  Kanan: {selectedElStats.distRightCm} cm
                </text>
              </g>
            </g>

            {/* 4. Center Status Indicator */}
            {selectedElStats.isCenteredX ? (
              <g transform={`translate(250, ${printArea.y + printArea.height + 26})`}>
                <rect
                  x="-88"
                  y="-10"
                  width="176"
                  height="20"
                  rx="10"
                  fill="#059669"
                  stroke="#A7F3D0"
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="9"
                  fontWeight="extrabold"
                  letterSpacing="0.4"
                >
                  ✓ POSISI TENGAH SIMETRIS
                </text>
              </g>
            ) : (
              <g transform={`translate(250, ${printArea.y + printArea.height + 26})`}>
                <rect
                  x="-75"
                  y="-9"
                  width="150"
                  height="18"
                  rx="9"
                  fill="#1E293B"
                  stroke="#94A3B8"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#CBD5E1"
                  fontSize="8.5"
                  fontWeight="semibold"
                >
                  Kiri {selectedElStats.distLeftCm} cm | Kanan {selectedElStats.distRightCm} cm
                </text>
              </g>
            )}
          </g>
        )}

        {/* =========================================================================
            9. RENDER DESIGN ELEMENTS (TEXT / IMAGE / CLIP ART)
        ========================================================================= */}
        {currentAngleElements.map((el) => {
          // Calculate absolute pixel in SVG space based on print area
          const posX = printArea.x + (el.x / 100) * printArea.width;
          const posY = printArea.y + (el.y / 100) * printArea.height;
          const isSelected = selectedElementId === el.id;

          const elW = el.width || 80;
          const elH = el.height || 80;
          const halfW = elW / 2;
          const halfH = elH / 2;
          const widthCm = Math.round((elW / printArea.width) * 30 * 10) / 10;
          const heightCm = Math.round((elH / printArea.height) * 42 * 10) / 10;

          return (
            <g
              key={el.id}
              transform={`translate(${posX}, ${posY}) rotate(${el.rotation}) scale(${el.scale})`}
              onMouseDown={(e) => handleElementMouseDown(e, el)}
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
                    letterSpacing: `${el.letterSpacing || 1}px`
                  }}
                >
                  {el.text || 'ATHREE JAYAPURA'}
                </text>
              )}

              {/* If Image */}
              {el.type === 'image' && el.src && (
                <image
                  href={el.src}
                  x={-halfW}
                  y={-halfH}
                  width={elW}
                  height={elH}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}

              {/* If Clipart */}
              {el.type === 'clipart' && (
                <g transform="translate(-30, -30)">
                  {renderVectorClipart(el.clipartName || 'star', el.fill || '#111827')}
                </g>
              )}

              {/* Selection Bounding Box, Corner Handles & Live CM Dimension Label (matching user screenshot) */}
              {isSelected && !isExporting && (
                <g>
                  {/* Outer Bounding Box */}
                  <rect
                    x={-(halfW + 6)}
                    y={-(halfH + 6)}
                    width={elW + 12}
                    height={elH + 12}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="1.8"
                    strokeDasharray="4,3"
                    rx="4"
                  />

                  {/* Dimension Tag (cm) Badge with clear label and contrast */}
                  <g transform={`translate(0, ${-(halfH + 26)})`}>
                    <rect
                      x={el.type === 'image' ? '-68' : '-52'}
                      y="0"
                      width={el.type === 'image' ? '136' : '104'}
                      height="20"
                      rx="5"
                      fill="#0F172A"
                      stroke="#38BDF8"
                      strokeWidth="1.4"
                    />
                    <text
                      x="0"
                      y="14"
                      textAnchor="middle"
                      fill="#38BDF8"
                      fontSize="9.5"
                      fontWeight="extrabold"
                      letterSpacing="0.4"
                    >
                      {el.type === 'image' ? `Ukuran: ${widthCm} × ${heightCm} cm` : `${widthCm} × ${heightCm} cm`}
                    </text>
                  </g>

                  {/* Corner Resize Handles */}
                  {/* Top-Left Handle */}
                  <rect
                    x={-(halfW + 11)}
                    y={-(halfH + 11)}
                    width="11"
                    height="11"
                    rx="2"
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth="2"
                    className="cursor-nwse-resize hover:fill-blue-100"
                    onMouseDown={(e) => handleHandleMouseDown(e, el, 'resize-tl')}
                  />
                  {/* Top-Right Handle */}
                  <rect
                    x={halfW}
                    y={-(halfH + 11)}
                    width="11"
                    height="11"
                    rx="2"
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth="2"
                    className="cursor-nesw-resize hover:fill-blue-100"
                    onMouseDown={(e) => handleHandleMouseDown(e, el, 'resize-tr')}
                  />
                  {/* Bottom-Left Handle */}
                  <rect
                    x={-(halfW + 11)}
                    y={halfH}
                    width="11"
                    height="11"
                    rx="2"
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth="2"
                    className="cursor-nesw-resize hover:fill-blue-100"
                    onMouseDown={(e) => handleHandleMouseDown(e, el, 'resize-bl')}
                  />
                  {/* Bottom-Right Handle */}
                  <rect
                    x={halfW}
                    y={halfH}
                    width="11"
                    height="11"
                    rx="2"
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth="2"
                    className="cursor-nwse-resize hover:fill-blue-100"
                    onMouseDown={(e) => handleHandleMouseDown(e, el, 'resize-br')}
                  />

                  {/* Circular Delete Button (X) on Element Bounding Box */}
                  {onDeleteElement && (
                    <g
                      className="cursor-pointer group/del"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteElement(el.id);
                      }}
                      title="Hapus Objek Ini"
                    >
                      <circle
                        cx={halfW + 12}
                        cy={-(halfH + 12)}
                        r="10"
                        fill="#EF4444"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        className="transition-transform group-hover/del:scale-125"
                      />
                      <path
                        d={`M ${halfW + 8.5} ${-(halfH + 15.5)} L ${halfW + 15.5} ${-(halfH + 8.5)} M ${halfW + 15.5} ${-(halfH + 15.5)} L ${halfW + 8.5} ${-(halfH + 8.5)}`}
                        stroke="#FFFFFF"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                </g>
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
