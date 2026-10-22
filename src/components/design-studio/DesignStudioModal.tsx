import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Shirt,
  Upload,
  Type,
  Smile,
  Layers,
  Image as ImageIcon,
  LayoutTemplate,
  HelpCircle,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Ruler,
  Download,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Palette,
  Maximize2,
  Minimize2,
  Eye,
  FileCheck,
  LogOut,
  Camera,
  Lock,
  Unlock,
  Move,
  AlignCenter
} from 'lucide-react';
import {
  ProductType,
  ViewAngle,
  ProductConfig,
  PRODUCT_CATALOG,
  DesignElement,
  ApparelColor
} from './designStudioTypes';
import { ApparelVectorMockup } from './ApparelVectorMockup';
import { SizeChartModal } from './SizeChartModal';
import { ProductSelectorModal } from './ProductSelectorModal';
import { CaptureModal } from './CaptureModal';
import { DualPreviewModal } from './DualPreviewModal';
import { compressImage } from '../../utils/imageCompressor';

type SidebarTool =
  | 'product'
  | 'upload'
  | 'text'
  | 'clipart'
  | 'layer'
  | 'my-images'
  | 'template'
  | 'help';

interface DesignStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductType?: ProductType;
  onApplyToInvoice?: (mockupDataUrl: string) => void;
  isInvoiceMode?: boolean;
  isDedicatedDesignUser?: boolean;
  isGuestMode?: boolean;
  onLogout?: () => void;
  onSwitchUser?: () => void;
  startWithSelector?: boolean;
}

export const DesignStudioModal: React.FC<DesignStudioModalProps> = ({
  isOpen,
  onClose,
  initialProductType = 'tshirt',
  onApplyToInvoice,
  isInvoiceMode = false,
  isDedicatedDesignUser = false,
  isGuestMode = false,
  onLogout,
  onSwitchUser,
  startWithSelector = false
}) => {
  const [productType, setProductType] = useState<ProductType>(initialProductType);
  const currentConfig: ProductConfig = PRODUCT_CATALOG[productType];

  const [activeTool, setActiveTool] = useState<SidebarTool>('product');
  const [activeAngle, setActiveAngle] = useState<ViewAngle>('depan');
  const [selectedColor, setSelectedColor] = useState<ApparelColor>(currentConfig.defaultColor);
  const [selectedSize, setSelectedSize] = useState<string>(currentConfig.availableSizes[1] || 'M');

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showPrintAreaGuide, setShowPrintAreaGuide] = useState<boolean>(true);
  const [isScale1to1Active, setIsScale1to1Active] = useState<boolean>(true);
  const [showGarmentMeasurements, setShowGarmentMeasurements] = useState<boolean>(false);
  const [uploadedGallery, setUploadedGallery] = useState<string[]>([]);

  // Modals inside Studio
  const [showSizeChart, setShowSizeChart] = useState<boolean>(false);
  const [showProductSelector, setShowProductSelector] = useState<boolean>(Boolean(startWithSelector));
  const [showCaptureModal, setShowCaptureModal] = useState<boolean>(false);
  const [capturedImageMockup, setCapturedImageMockup] = useState<string>('');
  const [capturedImageGuide, setCapturedImageGuide] = useState<string>('');
  const [isCapturingImage, setIsCapturingImage] = useState<boolean>(false);

  // 1. Full Screen Browser State (Default true for maximum work area)
  const [isFullScreenBrowser, setIsFullScreenBrowser] = useState<boolean>(true);

  // 3. Tombol Preview Depan & Belakang State
  const [showDualPreview, setShowDualPreview] = useState<boolean>(false);

  // 2. Aspect Ratio Lock for Manual Image Resizing
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);

  // Mockup view mode: auto (uses photo for Hitam/Merah/Kuning, flat clean vector for others)
  const [mockupMode, setMockupMode] = useState<'auto' | 'photo' | 'vector'>('auto');

  // Design elements state
  const [elements, setElements] = useState<DesignElement[]>([
    {
      id: 'default-text-1',
      type: 'text',
      angle: 'depan',
      x: 50,
      y: 40,
      width: 140,
      height: 35,
      rotation: 0,
      scale: 1,
      text: 'ATHREE JAYAPURA',
      fontFamily: 'Impact, sans-serif',
      fontSize: 22,
      fill: '#FFFFFF',
      fontWeight: 'bold',
      letterSpacing: 2
    }
  ]);

  const [selectedElementId, setSelectedElementId] = useState<string | null>('default-text-1');

  // History for Undo / Redo
  const [history, setHistory] = useState<DesignElement[][]>([elements]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Tool states: Add Text
  const [newText, setNewText] = useState<string>('CUSTOM DESIGN');
  const [newFont, setNewFont] = useState<string>('Impact, sans-serif');
  const [newTextColor, setNewTextColor] = useState<string>('#FFFFFF');
  const [newFontSize, setNewFontSize] = useState<number>(20);

  // Tool states: Upload Image
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);

  // Toast notice
  const [toastMessage, setToastMessage] = useState<string>('');

  // Toggle Full Screen Browser
  const toggleFullScreenBrowser = () => {
    setIsFullScreenBrowser((prev) => {
      const next = !prev;
      try {
        if (next) {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      } catch (e) {
        // Safe for iframe environment
      }
      return next;
    });
  };

  // Synchronize fullscreenchange event if user presses ESC or F11
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullScreenBrowser) {
        // Keep CSS fullscreen even if native exited, or keep synchronized
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullScreenBrowser]);

  // Handle live element position update
  const handleUpdateElementPosition = (id: string, x: number, y: number) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, x, y } : el)));
  };

  // Handle live element size update
  const handleUpdateElementSize = (id: string, width: number, height: number) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, width, height } : el)));
  };

  // Handle general element update
  const handleUpdateElement = (id: string, updates: Partial<DesignElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  // Update product default color when productType changes
  useEffect(() => {
    setSelectedColor(PRODUCT_CATALOG[productType].defaultColor);
    setSelectedSize(PRODUCT_CATALOG[productType].availableSizes[1] || 'M');
  }, [productType]);

  const pushHistory = (newElems: DesignElement[]) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push(newElems);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
    setElements(newElems);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setElements(history[newIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setElements(history[newIdx]);
    }
  };

  // Add text element to current angle
  const handleAddTextElement = () => {
    if (!newText.trim()) return;
    const newEl: DesignElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      angle: activeAngle,
      x: 50,
      y: 50,
      width: 140,
      height: 35,
      rotation: 0,
      scale: 1,
      text: newText.trim(),
      fontFamily: newFont,
      fontSize: newFontSize,
      fill: newTextColor,
      fontWeight: 'bold',
      letterSpacing: 1
    };
    pushHistory([...elements, newEl]);
    setSelectedElementId(newEl.id);
    showToast('Teks berhasil ditambahkan!');
  };

  // Handle Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const img = new Image();
          img.onload = () => {
            const aspect = img.naturalWidth / (img.naturalHeight || 1);
            let w = 100;
            let h = Math.round(100 / aspect);
            if (h > 150) {
              h = 150;
              w = Math.round(150 * aspect);
            }
            if (w > 160) {
              w = 160;
              h = Math.round(160 / aspect);
            }

            const widthCm = Math.round((w / 180) * 30 * 10) / 10;
            const heightCm = Math.round((h / 250) * 42 * 10) / 10;

            const newEl: DesignElement = {
              id: `img-${Date.now()}`,
              type: 'image',
              angle: activeAngle,
              x: 50,
              y: 50,
              width: w,
              height: h,
              rotation: 0,
              scale: 1,
              src: dataUrl
            };
            pushHistory([...elements, newEl]);
            setSelectedElementId(newEl.id);
            setUploadedGallery((prev) => (prev.includes(dataUrl) ? prev : [dataUrl, ...prev]));
            setActiveTool('upload');
            showToast(`Gambar diunggah! Ukuran: ${widthCm} × ${heightCm} cm. Bisa diubah manual.`);
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Clipart Element
  const handleAddClipart = (clipartName: string, fill: string = '#111827') => {
    const newEl: DesignElement = {
      id: `clipart-${Date.now()}`,
      type: 'clipart',
      angle: activeAngle,
      x: 50,
      y: 50,
      width: 60,
      height: 60,
      rotation: 0,
      scale: 1,
      clipartName,
      fill
    };
    pushHistory([...elements, newEl]);
    setSelectedElementId(newEl.id);
    showToast('Clip Art berhasil ditambahkan!');
  };

  // Delete Element
  const handleDeleteElement = (id: string) => {
    const updated = elements.filter((el) => el.id !== id);
    pushHistory(updated);
    if (selectedElementId === id) setSelectedElementId(null);
  };

  // Keyboard shortcut listener: Delete or Backspace removes selected object when not typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tagName = activeEl?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        e.preventDefault();
        handleDeleteElement(selectedElementId);
        showToast('Objek berhasil dihapus');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, elements]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Export Mockup Canvas to Image with optional Size Guide, 1:1 Scale, or DTF Print-Area crop
  const generateMockupImage = async (options?: {
    withGuide?: boolean;
    highRes?: boolean;
    printAreaOnly?: boolean;
  }): Promise<string> => {
    const svgEl = document.getElementById('apparel-mockup-svg');
    if (!svgEl) throw new Error('SVG Mockup tidak ditemukan');

    // Clone SVG to modify export layers safely without disturbing live DOM
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.style.transform = 'none';

    const guideEl = clone.querySelector('#garment-measurement-guide') as SVGElement | null;
    const rulerEl = clone.querySelector('#scale-1to1-rulers') as SVGElement | null;
    const printAreaGuide = clone.querySelector('#printable-area-guide') as SVGElement | null;
    const distanceGuide = clone.querySelector('#object-distance-guidelines') as SVGElement | null;

    if (printAreaGuide) {
      printAreaGuide.style.display = 'none';
    }
    if (distanceGuide) {
      distanceGuide.style.display = 'none';
    }

    if (options?.withGuide) {
      if (guideEl) guideEl.style.display = 'block';
      if (rulerEl) rulerEl.style.display = 'block';
    } else {
      if (guideEl) guideEl.style.display = 'none';
      if (rulerEl) rulerEl.style.display = 'none';
    }

    // Ensure image elements have absolute origin URLs for canvas rasterizer
    const imageElements = Array.from(clone.querySelectorAll('image'));
    for (const imgEl of imageElements) {
      const href = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href');
      if (href && href.startsWith('/')) {
        imgEl.setAttribute('href', window.location.origin + href);
      }
    }

    const svgXml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = window.URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        const outWidth = options?.highRes ? 1200 : 800;
        const outHeight = options?.highRes ? 1200 : 800;
        const canvas = document.createElement('canvas');
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.URL.revokeObjectURL(blobURL);
          return reject(new Error('Canvas context gagal'));
        }

        if (options?.printAreaOnly) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, outWidth, outHeight);
          // Crop into print area (approx coords 160, 140, 180, 250 in 500x600 SVG)
          const sx = (150 / 500) * image.naturalWidth;
          const sy = (130 / 600) * image.naturalHeight;
          const sw = (200 / 500) * image.naturalWidth;
          const sh = (270 / 600) * image.naturalHeight;
          ctx.drawImage(image, sx, sy, sw, sh, 60, 60, outWidth - 120, outHeight - 120);
        } else {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, outWidth, outHeight);
          const pad = options?.highRes ? 60 : 40;
          ctx.drawImage(image, pad, pad, outWidth - pad * 2, outHeight - pad * 2);
        }

        window.URL.revokeObjectURL(blobURL);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(dataUrl);
      };
      image.onerror = () => {
        window.URL.revokeObjectURL(blobURL);
        reject(new Error('Gagal merender mockup image'));
      };
      image.src = blobURL;
    });
  };

  // Action: Open Capture Modal (Skala 1:1 & Panduan Ukuran)
  const handleOpenCaptureModal = async (initialMode: 'mockup' | 'guide' | 'print-area' = 'guide') => {
    try {
      setIsCapturingImage(true);
      setShowCaptureModal(true);
      setSelectedElementId(null);
      // Wait a tick for selection outlines to dismiss
      await new Promise((r) => setTimeout(r, 60));
      const [imgGuide, imgClean] = await Promise.all([
        generateMockupImage({ withGuide: true, highRes: true }),
        generateMockupImage({ withGuide: false, highRes: true })
      ]);
      setCapturedImageGuide(imgGuide);
      setCapturedImageMockup(imgClean);
    } catch (e: any) {
      console.warn('Capture image error:', e);
      showToast('Gagal memproses capture gambar');
    } finally {
      setIsCapturingImage(false);
    }
  };

  const handleCaptureAgain = async (mode: 'mockup' | 'guide' | 'print-area') => {
    setIsCapturingImage(true);
    try {
      if (mode === 'print-area') {
        const imgPrint = await generateMockupImage({ printAreaOnly: true, highRes: true });
        setCapturedImageMockup(imgPrint);
      } else if (mode === 'guide') {
        const img = await generateMockupImage({ withGuide: true, highRes: true });
        setCapturedImageGuide(img);
      } else {
        const img = await generateMockupImage({ withGuide: false, highRes: true });
        setCapturedImageMockup(img);
      }
    } catch (err: any) {
      console.warn('Capture error:', err);
    } finally {
      setIsCapturingImage(false);
    }
  };

  // Action: Apply to Invoice (mockupDesign)
  const handleApplyToInvoice = async () => {
    try {
      showToast('Menyiapkan mockup untuk invoice...');
      setShowPrintAreaGuide(false);
      setSelectedElementId(null);

      // Brief wait for state render
      await new Promise((r) => setTimeout(r, 100));

      const mockupUrl = await generateMockupImage();
      setShowPrintAreaGuide(true);

      if (onApplyToInvoice) {
        onApplyToInvoice(mockupUrl);
      }
      onClose();
    } catch (err: any) {
      setShowPrintAreaGuide(true);
      alert(`Gagal menerapkan mockup: ${err?.message || 'Error tidak diketahui'}`);
    }
  };

  // Action: Download Mockup as PNG
  const handleDownloadMockup = async () => {
    try {
      showToast('Mengunduh mockup...');
      setShowPrintAreaGuide(false);
      setSelectedElementId(null);
      await new Promise((r) => setTimeout(r, 100));
      const mockupUrl = await generateMockupImage({ highRes: true });
      setShowPrintAreaGuide(true);

      const link = document.createElement('a');
      link.download = `mockup-${productType}-${selectedColor.name}-${activeAngle}.jpg`;
      link.href = mockupUrl;
      link.click();
      showToast('Mockup berhasil diunduh!');
    } catch (err: any) {
      setShowPrintAreaGuide(true);
      alert(`Gagal mengunduh mockup: ${err?.message || 'Error'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={
        isFullScreenBrowser
          ? 'fixed inset-0 z-50 bg-slate-900 w-screen h-screen m-0 p-0 overflow-hidden flex flex-col select-none'
          : 'fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 select-none overflow-hidden'
      }
    >
      <div
        className={
          isFullScreenBrowser
            ? 'w-full h-full flex flex-col overflow-hidden text-slate-800 bg-white rounded-none border-none shadow-none'
            : 'bg-white rounded-3xl w-full max-w-[1400px] h-[95vh] max-h-[900px] shadow-2xl border border-slate-700 flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150'
        }
      >
        {/* =========================================================================
            TOP NAV / HEADER
        ========================================================================= */}
        <header className="px-4 py-2 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight">
                  Design Studio Real 1:1
                </h1>
                <span className="text-[10px] bg-[#00871f] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {currentConfig.categoryLabel}
                </span>
                {isGuestMode && (
                  <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                    <Sparkles className="w-3 h-3 text-purple-200" />
                    Bebas Akses (Tanpa Login)
                  </span>
                )}
                {productType === 'tshirt' && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    Panduan Ukuran Terlampir
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 hidden sm:block">
                {currentConfig.fullName} &bull; Warna: {selectedColor.name} &bull; Ukuran: {selectedSize}
              </p>
            </div>
          </div>

          {/* Quick Product Switcher Tabs (1. Kaos T-Shirt, 2. Polo, 3. Hoodie, 4. Jersey) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            {[
              { id: 'tshirt' as ProductType, num: '1', label: 'Kaos T -Shirt' },
              { id: 'polo' as ProductType, num: '2', label: 'Polo' },
              { id: 'hoodie' as ProductType, num: '3', label: 'Hoodie' },
              { id: 'jersey' as ProductType, num: '4', label: 'Jersey' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProductType(p.id);
                  if (p.id === 'tshirt') {
                    showToast('1. Kaos T-Shirt Real 1:1 Aktif (Panduan Ukuran Terlampir)');
                  } else if (p.id === 'polo') {
                    showToast('2. Kaos Polo-Shirt Aktif');
                  } else if (p.id === 'hoodie') {
                    showToast('3. Hoodie Aktif');
                  } else {
                    showToast('4. Jersey Sport Aktif');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  productType === p.id
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/30 text-[10px] font-black flex items-center justify-center">
                  {p.num}
                </span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            {/* 3. TOMBOL PREVIEW: LIHAT GAMBAR DEPAN & BELAKANG */}
            <button
              onClick={() => setShowDualPreview(true)}
              className="px-2.5 sm:px-3.5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-purple-950/20 transition-all cursor-pointer active:scale-95"
              title="Lihat Preview Gambar Depan & Belakang Sekaligus"
            >
              <Eye className="w-3.5 h-3.5 text-purple-200" />
              <span className="whitespace-nowrap">Preview Depan &amp; Belakang</span>
            </button>

            {/* 1. TOMBOL FULL SCREEN BROWSER */}
            <button
              onClick={toggleFullScreenBrowser}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isFullScreenBrowser
                  ? 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
              }`}
              title={isFullScreenBrowser ? 'Tampilan Jendela Standar' : 'Tampilan Full Screen Browser'}
            >
              {isFullScreenBrowser ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullScreenBrowser ? 'Layar Penuh' : 'Full Screen'}</span>
            </button>

            {/* Capture Gambar Skala 1:1 button */}
            <button
              onClick={() => handleOpenCaptureModal('guide')}
              className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              title="Capture Gambar Real 1:1 Lengkap dengan Panduan Ukuran (LD x P x L)"
            >
              <Camera className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
              <span className="whitespace-nowrap">Capture (1:1)</span>
            </button>

            {/* Mulai Design Baru (Modal 4 Pilihan) */}
            <button
              onClick={() => setShowProductSelector(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              title="Pilihan Mulai Design: 1. Kaos T-Shirt, 2. Polo, 3. Hoodie, 4. Jersey"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span className="hidden sm:inline">Mulai Design</span>
            </button>

            <button
              onClick={() => setShowSizeChart(true)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer relative"
              title="Lihat tabel ukuran asli 1:1 (LD, P, L)"
            >
              <Ruler className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Panduan Ukuran</span>
              {productType === 'tshirt' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-1 right-1"></span>
              )}
            </button>

            <button
              onClick={handleDownloadMockup}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download gambar mockup JPG"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden xl:inline">Download</span>
            </button>

            {/* Apply To Invoice Button */}
            {onApplyToInvoice && (
              <button
                onClick={handleApplyToInvoice}
                className="px-3.5 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer active:scale-95"
                title="Gunakan desain ini sebagai mockup faktur/invoice transaksi"
              >
                <FileCheck className="w-4 h-4" />
                <span>Gunakan di Invoice</span>
              </button>
            )}

            {/* Logout button for dedicated user Design */}
            {isDedicatedDesignUser && onLogout && (
              <button
                onClick={onLogout}
                className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Keluar / Logout dari User Design"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden md:inline">Logout</span>
              </button>
            )}

            {/* Exit to Login button for Guest Mode */}
            {isGuestMode && (
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-600/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Keluar ke Halaman Login Kasir"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kembali ke Login</span>
              </button>
            )}

            <button
              onClick={() => {
                if (isDedicatedDesignUser) {
                  setShowProductSelector(true);
                } else {
                  onClose();
                }
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title={isDedicatedDesignUser ? 'Mulai Desain Baru' : isGuestMode ? 'Kembali ke Login' : 'Tutup Studio'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* =========================================================================
            MAIN STUDIO BODY (3 COLUMNS: LEFT TOOLS + CENTER CANVAS + RIGHT ANGLES)
        ========================================================================= */}
        <div className="flex-1 flex overflow-hidden bg-slate-100">
          {/* =====================================================================
              1. LEFTMOST VERTICAL ICON TOOLBAR (matching Images 2, 3, 4)
          ===================================================================== */}
          <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-1 shrink-0 z-10">
            {[
              { id: 'product', label: 'Product', icon: Shirt },
              { id: 'upload', label: 'Upload Image', icon: Upload },
              { id: 'text', label: 'Add Text', icon: Type },
              { id: 'clipart', label: 'Add Clip Art', icon: Smile },
              { id: 'layer', label: 'Layer', icon: Layers },
              { id: 'my-images', label: 'My Images', icon: ImageIcon },
              { id: 'template', label: 'Template', icon: LayoutTemplate },
              { id: 'help', label: 'Help', icon: HelpCircle }
            ].map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id as SidebarTool)}
                  className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative group ${
                    isActive
                      ? 'bg-emerald-50 text-[#00871f] border-2 border-[#00871f] font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                  }`}
                  title={tool.label}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#00871f]' : 'text-slate-600'}`} />
                  <span className="text-[9.5px] leading-tight text-center font-medium px-0.5 truncate max-w-full">
                    {tool.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* =====================================================================
              2. LEFT DRAWER SETTINGS PANEL (matching Images 2, 3, 4)
          ===================================================================== */}
          <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0 shadow-sm">
            {/* 2A. PRODUCT TAB (matching Images 2, 3, 4) */}
            {activeTool === 'product' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* Product Name Header */}
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                    {currentConfig.fullName}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {currentConfig.description}
                  </p>
                </div>

                {/* 4 Pilihan Mulai Design (Kaos T-Shirt, Polo, Hoodie, Jersey) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-slate-800 text-xs">Pilihan Mulai Design:</span>
                    <button
                      type="button"
                      onClick={() => setShowProductSelector(true)}
                      className="text-[#00871f] font-bold text-[10.5px] hover:underline cursor-pointer"
                    >
                      Buka Modal Pilihan
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'tshirt' as ProductType, num: '1', name: 'Kaos T -Shirt' },
                      { id: 'polo' as ProductType, num: '2', name: 'Polo' },
                      { id: 'hoodie' as ProductType, num: '3', name: 'Hoodie' },
                      { id: 'jersey' as ProductType, num: '4', name: 'Jersey' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setProductType(opt.id);
                          if (opt.id === 'tshirt') {
                            showToast('1. Kaos T-Shirt Real 1:1 Aktif (Panduan Ukuran Terlampir)');
                          } else if (opt.id === 'polo') {
                            showToast('2. Kaos Polo-Shirt Aktif');
                          } else if (opt.id === 'hoodie') {
                            showToast('3. Hoodie Aktif');
                          } else {
                            showToast('4. Jersey Sport Aktif');
                          }
                        }}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          productType === opt.id
                            ? 'bg-[#00871f] text-white border-[#00871f] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-black/20 text-[10px] font-black flex items-center justify-center">
                          {opt.num}
                        </span>
                        <span className="truncate">{opt.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Real 1:1 Scale & Panduan Ukuran Terlampir Badge */}
                {productType === 'tshirt' && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#00871f]">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ukuran Sesuai Real 1:1 dari Aslinya</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Sesuai standar pola New States Apparel 7200. Panduan ukuran terlampir (LD x P x L).
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSizeChart(true)}
                      className="mt-1 w-full py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Ruler className="w-3 h-3" />
                      <span>Buka Panduan Ukuran T-Shirt</span>
                    </button>
                  </div>
                )}

                {/* Buttons: Product Details & Ganti Produk (matching Images 2, 3, 4) */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowSizeChart(true)}
                    className="py-2 px-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 rounded-xl text-center text-xs transition-colors cursor-pointer"
                  >
                    Product Details
                  </button>
                  <button
                    onClick={() => setShowProductSelector(true)}
                    className="py-2 px-2.5 bg-[#2D3139] hover:bg-slate-800 text-white font-bold rounded-xl text-center text-xs transition-colors cursor-pointer"
                  >
                    Ganti Produk
                  </button>
                </div>

                {/* Ukuran + Link "Panduan Ukuran" (matching Images 2, 3, 4) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-800">Ukuran:</span>
                    <button
                      onClick={() => setShowSizeChart(true)}
                      className="text-[#00871f] hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      Panduan Ukuran
                    </button>
                  </div>
                  {/* Sizes Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {currentConfig.availableSizes.map((sz) => {
                      const isSel = selectedSize === sz;
                      return (
                        <button
                          key={sz}
                          onClick={() => setSelectedSize(sz)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                            isSel
                              ? 'bg-[#00871f] text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Warna + Color Swatches Grid (matching Images 2, 3, 4) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-800">
                      Warna: <span className="text-[#00871f] font-extrabold">{selectedColor.name}</span>
                    </span>
                  </div>

                  {/* Swatches Grid */}
                  <div className="grid grid-cols-7 gap-2 pt-1">
                    {currentConfig.colors.map((c) => {
                      const isSel = selectedColor.name === c.name;
                      return (
                        <button
                          key={c.name}
                          onClick={() => setSelectedColor(c)}
                          title={c.name}
                          className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative shadow-xs ${
                            isSel ? 'ring-2 ring-offset-2 ring-[#00871f] scale-110' : 'hover:scale-105'
                          }`}
                          style={{
                            backgroundColor: c.hex,
                            border: c.border ? `1px solid ${c.border}` : '1px solid rgba(0,0,0,0.15)'
                          }}
                        >
                          {isSel && (
                            <span
                              className="absolute inset-0 flex items-center justify-center font-bold text-xs"
                              style={{ color: c.textColor || '#FFFFFF' }}
                            >
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Spesifikasi (matching Images 2, 3, 4) */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-800 block mb-1.5">Spesifikasi:</span>
                  <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside leading-relaxed">
                    {currentConfig.specs.map((sp, idx) => (
                      <li key={idx} className="truncate">
                        {sp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 2B. UPLOAD IMAGE TAB & PENGATURAN UKURAN GAMBAR MANUAL */}
            {activeTool === 'upload' && (() => {
              const angleImageElements = elements.filter((el) => el.type === 'image' && el.angle === activeAngle);
              const selectedEl = elements.find((el) => el.id === selectedElementId);
              const currentImage = (selectedEl && selectedEl.type === 'image' && selectedEl.angle === activeAngle)
                ? selectedEl
                : angleImageElements[angleImageElements.length - 1] || null;

              const currentWidthCm = currentImage ? Math.round(((currentImage.width || 80) / 180) * 30 * 10) / 10 : 16.7;
              const currentHeightCm = currentImage ? Math.round(((currentImage.height || 80) / 250) * 42 * 10) / 10 : 16.8;

              const handleSetWidthCm = (targetCm: number) => {
                if (!currentImage) return;
                const clampedCm = Math.max(2, Math.min(30, Math.round(targetCm * 10) / 10));
                const newSvgWidth = Math.round((clampedCm / 30) * 180);
                let newSvgHeight = currentImage.height || 80;
                if (lockAspectRatio) {
                  const aspect = (currentImage.width || 80) / (currentImage.height || 80 || 1);
                  newSvgHeight = Math.round(newSvgWidth / (aspect || 1));
                }
                handleUpdateElementSize(currentImage.id, newSvgWidth, newSvgHeight);
              };

              const handleSetHeightCm = (targetCm: number) => {
                if (!currentImage) return;
                const clampedCm = Math.max(2, Math.min(42, Math.round(targetCm * 10) / 10));
                const newSvgHeight = Math.round((clampedCm / 42) * 250);
                let newSvgWidth = currentImage.width || 80;
                if (lockAspectRatio) {
                  const aspect = (currentImage.width || 80) / (currentImage.height || 80 || 1);
                  newSvgWidth = Math.round(newSvgHeight * (aspect || 1));
                }
                handleUpdateElementSize(currentImage.id, newSvgWidth, newSvgHeight);
              };

              const handlePresetSize = (wCm: number, hCm: number, label: string) => {
                if (!currentImage) return;
                const newSvgW = Math.round((wCm / 30) * 180);
                const newSvgH = Math.round((hCm / 42) * 250);
                handleUpdateElementSize(currentImage.id, newSvgW, newSvgH);
                showToast(`Ukuran diatur ke ${label} (${wCm} × ${hCm} cm)`);
              };

              return (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Upload &amp; Ukuran Gambar</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload logo/gambar, atur ukuran manual (cm), dan cek keterangan skala 1:1
                    </p>
                  </div>

                  {/* Multiple Images Selector if more than 1 image on this angle */}
                  {angleImageElements.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">Pilih Gambar yang Diedit:</label>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {angleImageElements.map((imgEl, idx) => (
                          <button
                            key={imgEl.id}
                            onClick={() => setSelectedElementId(imgEl.id)}
                            className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                              currentImage?.id === imgEl.id
                                ? 'bg-emerald-50 border-[#00871f] text-[#00871f] font-bold shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <img src={imgEl.src} alt="Thumb" className="w-4 h-4 object-contain rounded" />
                            <span>Gambar #{idx + 1}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KETERANGAN UKURAN GAMBAR YANG DI-UPLOAD */}
                  {currentImage ? (
                    <div className="space-y-3.5">
                      <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2.5 border border-slate-700 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Ruler className="w-4 h-4 text-sky-400" />
                            <span className="font-extrabold text-xs text-sky-300">
                              Keterangan Ukuran Gambar
                            </span>
                          </div>
                          <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
                            Skala 1:1
                          </span>
                        </div>

                        {/* Real CM Dimension Display */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Lebar Gambar:</span>
                            <span className="text-base font-black text-sky-400 tracking-tight">
                              {currentWidthCm} cm
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Tinggi Gambar:</span>
                            <span className="text-base font-black text-sky-400 tracking-tight">
                              {currentHeightCm} cm
                            </span>
                          </div>
                        </div>

                        {/* Additional Dimension Notes */}
                        <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Area Cetak:</span>
                            <span className="font-bold text-emerald-400">DTF A3 (30 × 42 cm)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Posisi Baju:</span>
                            <span className="text-slate-200 font-semibold">
                              X: {Math.round(currentImage.x)}% &bull; Y: {Math.round(currentImage.y)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Status Sablon:</span>
                            <span className={`font-bold ${currentWidthCm <= 30 && currentHeightCm <= 42 ? 'text-emerald-300' : 'text-amber-400'}`}>
                              {currentWidthCm <= 30 && currentHeightCm <= 42 ? '✓ Aman Dalam Area Cetak' : '⚠️ Melebihi Batas A3'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* UBAH UKURAN GAMBAR SECARA MANUAL */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-800 text-xs">
                            Ubah Ukuran Manual (cm)
                          </span>
                          <button
                            type="button"
                            onClick={() => setLockAspectRatio(!lockAspectRatio)}
                            className={`flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                              lockAspectRatio
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-slate-100 text-slate-500 border-slate-300'
                            }`}
                            title={lockAspectRatio ? 'Proporsi Terkunci' : 'Proporsi Bebas (Distorsi)'}
                          >
                            {lockAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            <span>{lockAspectRatio ? 'Kunci Proporsi' : 'Bebas'}</span>
                          </button>
                        </div>

                        {/* Input Lebar Gambar (cm) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700">Lebar (Width):</label>
                            <span className="font-mono font-bold text-emerald-700">{currentWidthCm} cm</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetWidthCm(currentWidthCm - 0.5)}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="0.5"
                              min="2"
                              max="30"
                              value={currentWidthCm}
                              onChange={(e) => handleSetWidthCm(parseFloat(e.target.value) || 2)}
                              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                            />
                            <button
                              type="button"
                              onClick={() => handleSetWidthCm(currentWidthCm + 0.5)}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              +
                            </button>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="30"
                            step="0.5"
                            value={currentWidthCm}
                            onChange={(e) => handleSetWidthCm(parseFloat(e.target.value))}
                            className="w-full accent-[#00871f] cursor-pointer"
                          />
                        </div>

                        {/* Input Tinggi Gambar (cm) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-700">Tinggi (Height):</label>
                            <span className="font-mono font-bold text-emerald-700">{currentHeightCm} cm</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetHeightCm(currentHeightCm - 0.5)}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="0.5"
                              min="2"
                              max="42"
                              value={currentHeightCm}
                              onChange={(e) => handleSetHeightCm(parseFloat(e.target.value) || 2)}
                              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                            />
                            <button
                              type="button"
                              onClick={() => handleSetHeightCm(currentHeightCm + 0.5)}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                            >
                              +
                            </button>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="42"
                            step="0.5"
                            value={currentHeightCm}
                            onChange={(e) => handleSetHeightCm(parseFloat(e.target.value))}
                            className="w-full accent-[#00871f] cursor-pointer"
                          />
                        </div>

                        {/* Preset Ukuran Standar Cetak Sablon DTF */}
                        <div className="pt-2 border-t border-slate-200 space-y-1.5">
                          <span className="text-[10.5px] font-bold text-slate-600 block">Preset Ukuran Cepat:</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePresetSize(8, 8, 'Logo Saku')}
                              className="px-2 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-[#00871f] rounded-lg text-slate-700 font-bold text-[10.5px] text-left transition-colors cursor-pointer"
                            >
                              <span className="block text-slate-900">Saku Dada</span>
                              <span className="text-[9.5px] text-slate-400">8 × 8 cm</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetSize(15, 15, 'Dada Sedang')}
                              className="px-2 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-[#00871f] rounded-lg text-slate-700 font-bold text-[10.5px] text-left transition-colors cursor-pointer"
                            >
                              <span className="block text-slate-900">Dada Sedang</span>
                              <span className="text-[9.5px] text-slate-400">15 × 15 cm</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetSize(21, 29.7, 'Sablon A4')}
                              className="px-2 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-[#00871f] rounded-lg text-slate-700 font-bold text-[10.5px] text-left transition-colors cursor-pointer"
                            >
                              <span className="block text-slate-900">Sablon A4</span>
                              <span className="text-[9.5px] text-slate-400">21 × 29.7 cm</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePresetSize(28, 38, 'Maksimal A3')}
                              className="px-2 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-[#00871f] rounded-lg text-slate-700 font-bold text-[10.5px] text-left transition-colors cursor-pointer"
                            >
                              <span className="block text-slate-900">Maksimal A3</span>
                              <span className="text-[9.5px] text-slate-400">28 × 38 cm</span>
                            </button>
                          </div>
                        </div>

                        {/* Tombol Posisi Cepat */}
                        <div className="pt-2 border-t border-slate-200 space-y-1.5">
                          <span className="text-[10.5px] font-bold text-slate-600 block">Posisi Gambar di Kaos:</span>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateElementPosition(currentImage.id, 50, 30)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10.5px] font-bold text-slate-700 cursor-pointer"
                            >
                              Dada Atas
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateElementPosition(currentImage.id, 50, 50)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10.5px] font-bold text-slate-700 cursor-pointer"
                            >
                              Tengah (Center)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateElementPosition(currentImage.id, 35, 30)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10.5px] font-bold text-slate-700 cursor-pointer"
                            >
                              Saku Kiri
                            </button>
                          </div>
                        </div>

                        {/* Hapus Gambar */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Atau seret sudut di baju untuk resize</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteElement(currentImage.id)}
                            className="text-rose-600 hover:text-rose-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus Gambar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* Upload Dropzone */}
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-700 block text-[11px]">
                      {currentImage ? 'Unggah Gambar Lainnya:' : 'Unggah File Gambar / Logo:'}
                    </span>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-[#00871f] rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/70 hover:bg-emerald-50/40"
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#00871f] flex items-center justify-center mx-auto mb-1.5">
                        <Upload className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-800 block text-xs">Klik untuk Upload File</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        PNG, JPG, SVG transparan (Maks. 10 MB)
                      </span>
                    </div>
                  </div>

                  {/* Paste from Clipboard reminder */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#00871f]" />
                      Tips Cepat:
                    </p>
                    <p className="text-slate-600 leading-snug">
                      Kamu juga bisa tekan <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold">Ctrl + V</kbd> untuk langsung menempelkan gambar logo dari clipboard.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* 2C. ADD TEXT TAB */}
            {/* 2C. ADD TEXT TAB */}
            {activeTool === 'text' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Tambah Teks Kustom</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ketik kata atau kalimat untuk dicetak di baju
                  </p>
                </div>

                {/* If a text element is currently selected on this angle, show edit & delete controls */}
                {(() => {
                  const activeTextEl = elements.find((el) => el.id === selectedElementId && el.angle === activeAngle && el.type === 'text');
                  if (!activeTextEl) return null;
                  return (
                    <div className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-3 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          Edit Teks Terpilih
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteElement(activeTextEl.id);
                            showToast('Teks berhasil dihapus');
                          }}
                          className="text-rose-600 hover:text-rose-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:underline"
                          title="Hapus teks ini dari baju"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Teks</span>
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-700 block">Ubah Teks:</label>
                        <input
                          type="text"
                          value={activeTextEl.text || ''}
                          onChange={(e) => handleUpdateElement(activeTextEl.id, { text: e.target.value })}
                          className="w-full text-xs font-bold px-3 py-1.5 border border-emerald-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 border-t border-emerald-200">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateElementPosition(activeTextEl.id, 50, activeTextEl.y);
                            showToast('Teks diposisikan tepat di tengah baju');
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Posisikan teks tepat di tengah baju"
                        >
                          <AlignCenter className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tengahkan Teks</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteElement(activeTextEl.id);
                            showToast('Teks berhasil dihapus');
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Hapus teks dari pakaian"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-1 border-t border-slate-200">
                  <label className="font-bold text-slate-700 block mb-1">Isi Teks Baru:</label>
                  <input
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Ketik teks desain..."
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Gaya Font:</label>
                  <select
                    value={newFont}
                    onChange={(e) => setNewFont(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none bg-white"
                  >
                    <option value="Impact, sans-serif">Impact (Bold Streetwear)</option>
                    <option value="'Arial Black', sans-serif">Arial Black (Solid)</option>
                    <option value="'Bebas Neue', sans-serif">Bebas Neue (Athletic Sport)</option>
                    <option value="'Roboto', sans-serif">Roboto (Clean Minimalist)</option>
                    <option value="'Courier New', monospace">Courier (Typewriter Retro)</option>
                    <option value="'Georgia', serif">Georgia (Classic Elegance)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Ukuran Font:</label>
                    <input
                      type="number"
                      min="12"
                      max="72"
                      value={newFontSize}
                      onChange={(e) => setNewFontSize(Number(e.target.value) || 20)}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Warna Teks:</label>
                    <input
                      type="color"
                      value={newTextColor}
                      onChange={(e) => setNewTextColor(e.target.value)}
                      className="w-full h-9 p-0.5 border border-slate-300 rounded-xl cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddTextElement}
                  className="w-full py-2.5 bg-[#00871f] hover:bg-[#007019] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambahkan Teks ke Baju</span>
                </button>
              </div>
            )}

            {/* 2D. ADD CLIP ART TAB */}
            {activeTool === 'clipart' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Koleksi Clip Art &amp; Emblem</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih ikon atau lencana untuk ditempatkan pada baju
                  </p>
                </div>

                {/* If a clipart element is selected, show edit & delete controls */}
                {(() => {
                  const activeClipEl = elements.find((el) => el.id === selectedElementId && el.angle === activeAngle && el.type === 'clipart');
                  if (!activeClipEl) return null;
                  return (
                    <div className="bg-emerald-50/80 border border-emerald-300 rounded-2xl p-3 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950 text-xs">
                          Clip Art Terpilih: {activeClipEl.clipartName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteElement(activeClipEl.id);
                            showToast('Clip Art berhasil dihapus');
                          }}
                          className="text-rose-600 hover:text-rose-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateElementPosition(activeClipEl.id, 50, activeClipEl.y);
                            showToast('Clip Art diposisikan tepat di tengah baju');
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <AlignCenter className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tengahkan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteElement(activeClipEl.id);
                            showToast('Clip Art berhasil dihapus');
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'jayapura', label: 'Jayapura Papua', color: '#DC2626' },
                    { id: 'sport-shield', label: 'Sport Shield', color: '#1D4ED8' },
                    { id: 'star', label: 'Bintang Prestasi', color: '#FACC15' },
                    { id: 'flame', label: 'Api Semangat', color: '#EA580C' }
                  ].map((clip) => (
                    <button
                      key={clip.id}
                      onClick={() => handleAddClipart(clip.id, clip.color)}
                      className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-[#00871f] rounded-xl flex flex-col items-center gap-2 transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Smile className="w-7 h-7 text-[#00871f]" />
                      </div>
                      <span className="font-bold text-slate-800 text-[11px]">{clip.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2E. LAYER TAB */}
            {activeTool === 'layer' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Daftar Layer Desain</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Elemen yang aktif pada sudut ({activeAngle})
                  </p>
                </div>

                {elements.filter((el) => el.angle === activeAngle).length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <span>Belum ada elemen di sudut ini</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {elements
                      .filter((el) => el.angle === activeAngle)
                      .map((el, i) => (
                        <div
                          key={el.id}
                          onClick={() => setSelectedElementId(el.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                            selectedElementId === el.id
                              ? 'bg-emerald-50 border-[#00871f]'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <span className="font-bold text-slate-800 truncate">
                              {el.type === 'text' ? `Teks: "${el.text}"` : el.type === 'image' ? 'Gambar/Logo' : 'Clip Art'}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteElement(el.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Hapus layer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* 2F. MY IMAGES TAB */}
            {activeTool === 'my-images' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Koleksi Gambar Saya</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Logo &amp; gambar yang telah diunggah untuk ditempelkan ke kaos
                  </p>
                </div>

                {uploadedGallery.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl p-4">
                    <ImageIcon className="w-8 h-8 mx-auto opacity-50" />
                    <p>Belum ada gambar yang diunggah</p>
                    <button
                      type="button"
                      onClick={() => setActiveTool('upload')}
                      className="px-3 py-1.5 bg-[#00871f] text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Unggah Gambar Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {uploadedGallery.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const newEl: DesignElement = {
                            id: `img-${Date.now()}-${idx}`,
                            type: 'image',
                            angle: activeAngle,
                            x: 50,
                            y: 50,
                            width: 100,
                            height: 100,
                            rotation: 0,
                            scale: 1,
                            src: imgSrc
                          };
                          pushHistory([...elements, newEl]);
                          setSelectedElementId(newEl.id);
                          showToast('Gambar ditempelkan ke pakaian!');
                        }}
                        className="p-2 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-[#00871f] rounded-xl cursor-pointer transition-all flex flex-col items-center gap-1 group"
                      >
                        <img src={imgSrc} alt="Uploaded logo" className="w-16 h-16 object-contain group-hover:scale-105 transition-transform" />
                        <span className="text-[10px] font-bold text-slate-700">Gunakan</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2G. TEMPLATE TAB */}
            {activeTool === 'template' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Template Siap Pakai</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih konsep desain instan untuk pakaian
                  </p>
                </div>

                {[
                  {
                    title: 'Streetwear Vintage Distro',
                    desc: 'Tipografi bold dengan aksen nomor 77 di dada',
                    action: () => {
                      const t1: DesignElement = {
                        id: `tmpl-1`,
                        type: 'text',
                        angle: 'depan',
                        x: 50,
                        y: 35,
                        width: 140,
                        height: 35,
                        rotation: 0,
                        scale: 1,
                        text: 'ORIGINAL APPAREL',
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 20,
                        fill: '#FFFFFF',
                        fontWeight: 'bold',
                        letterSpacing: 2
                      };
                      const t2: DesignElement = {
                        id: `tmpl-2`,
                        type: 'text',
                        angle: 'depan',
                        x: 50,
                        y: 50,
                        width: 140,
                        height: 50,
                        rotation: 0,
                        scale: 1.2,
                        text: '77',
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 48,
                        fill: '#FACC15',
                        fontWeight: 'bold'
                      };
                      pushHistory([...elements, t1, t2]);
                      showToast('Template Streetwear diterapkan!');
                    }
                  },
                  {
                    title: 'Komunitas Jayapura Papua',
                    desc: 'Desain identitas komunitas lokal Jayapura',
                    action: () => {
                      const t1: DesignElement = {
                        id: `tmpl-jyp`,
                        type: 'text',
                        angle: 'depan',
                        x: 50,
                        y: 45,
                        width: 140,
                        height: 35,
                        rotation: 0,
                        scale: 1,
                        text: 'JAYAPURA PRIDE',
                        fontFamily: 'Impact, sans-serif',
                        fontSize: 22,
                        fill: '#FFFFFF',
                        fontWeight: 'bold'
                      };
                      pushHistory([...elements, t1]);
                      showToast('Template Jayapura diterapkan!');
                    }
                  }
                ].map((tmpl, idx) => (
                  <div
                    key={idx}
                    onClick={tmpl.action}
                    className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-[#00871f] rounded-xl cursor-pointer transition-all"
                  >
                    <h4 className="font-bold text-slate-800">{tmpl.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{tmpl.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 2H. HELP TAB */}
            {activeTool === 'help' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed text-slate-600">
                <h3 className="font-bold text-sm text-slate-900">Panduan Penggunaan Studio</h3>
                <p>
                  1. <strong>Pilih Warna &amp; Ukuran</strong> pada tab <em>Product</em> untuk menyesuaikan bahan baku.
                </p>
                <p>
                  2. <strong>Sudut Tampilan</strong>: Gunakan panel di sebelah kanan untuk mendesain bagian <em>Depan</em>, <em>Belakang</em>, <em>Lengan</em>, maupun <em>Label Kerah</em>.
                </p>
                <p>
                  3. <strong>Skala 1:1</strong>: Aktifkan tombol <em>Skala 1:1</em> di canvas untuk melihat penggaris metrik (cm) dan ukuran asli sablon.
                </p>
                <p>
                  4. <strong>Panduan Ukuran</strong>: Klik <em>Panduan Ukuran</em> untuk melihat tabel ukuran Lebar Dada (LD), Panjang (P), dan Lengan (L).
                </p>
              </div>
            )}
          </div>

          {/* =====================================================================
              3. CENTER MAIN CANVAS AREA (matching Images 2, 3, 4)
          ===================================================================== */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-100">
            {/* Top Canvas Floating Controls (Undo, Redo, Zoom, Skala 1:1, Panduan Ukuran) */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-2xl p-1.5 shadow-md text-xs">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-2 hover:bg-slate-100 text-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"
                title="Undo (Ctrl + Z)"
              >
                <Undo2 className="w-4 h-4 mx-auto" />
                <span className="text-[9px] font-bold block text-center">Undo</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 hover:bg-slate-100 text-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"
                title="Redo (Ctrl + Y)"
              >
                <Redo2 className="w-4 h-4 mx-auto" />
                <span className="text-[9px] font-bold block text-center">Redo</span>
              </button>
              <div className="h-px bg-slate-200 my-0.5" />
              <button
                onClick={() => setZoomLevel((z) => Math.min(2, z + 0.15))}
                className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Perbesar Zoom"
              >
                <ZoomIn className="w-4 h-4 mx-auto" />
                <span className="text-[9px] font-bold block text-center">Perbesar</span>
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Perkecil Zoom"
              >
                <ZoomOut className="w-4 h-4 mx-auto" />
                <span className="text-[9px] font-bold block text-center">Perkecil</span>
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors cursor-pointer"
                title="Reset Zoom (100%)"
              >
                <RotateCcw className="w-4 h-4 mx-auto" />
                <span className="text-[9px] font-bold block text-center">Reset</span>
              </button>
              <div className="h-px bg-slate-200 my-0.5" />
              <button
                onClick={() => {
                  setIsScale1to1Active((prev) => !prev);
                  if (!isScale1to1Active) {
                    setZoomLevel(1);
                    showToast('Mode Skala 1:1 Aktif (Penggaris Metrik CM)');
                  } else {
                    showToast('Mode Skala 1:1 Nonaktif');
                  }
                }}
                className={`p-2 rounded-xl transition-colors cursor-pointer relative ${
                  isScale1to1Active
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
                title="Skala 1:1 Real Size (Penggaris Metrik CM)"
              >
                <Ruler className="w-4 h-4 mx-auto" />
                <span className="text-[9px] font-bold block text-center">Skala 1:1</span>
                {isScale1to1Active && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                )}
              </button>

              <button
                onClick={() => {
                  setShowGarmentMeasurements((prev) => !prev);
                  showToast(!showGarmentMeasurements ? 'Panduan Ukuran (LD x P x L) Aktif' : 'Panduan Ukuran Sembunyi');
                }}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  showGarmentMeasurements
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
                title="Panduan Ukuran Baju (LD x P x L)"
              >
                <Eye className="w-4 h-4 mx-auto" />
                <span className="text-[9px] font-bold block text-center">Ukuran</span>
              </button>

              <div className="h-px bg-slate-200 my-0.5" />

              {/* 3. Preview Depan & Belakang floating button */}
              <button
                onClick={() => setShowDualPreview(true)}
                className="p-2 hover:bg-purple-50 text-purple-700 rounded-xl transition-colors cursor-pointer group"
                title="Preview Gambar Tampak Depan & Belakang"
              >
                <Eye className="w-4 h-4 mx-auto text-purple-600 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-extrabold block text-center text-purple-800">Preview</span>
              </button>

              {/* 1. Full Screen Browser floating button */}
              <button
                onClick={toggleFullScreenBrowser}
                className="p-2 hover:bg-sky-50 text-sky-700 rounded-xl transition-colors cursor-pointer group"
                title={isFullScreenBrowser ? 'Keluar Full Screen Browser' : 'Tampilan Full Screen Browser'}
              >
                {isFullScreenBrowser ? (
                  <Minimize2 className="w-4 h-4 mx-auto text-sky-600 group-hover:scale-110 transition-transform" />
                ) : (
                  <Maximize2 className="w-4 h-4 mx-auto text-sky-600 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-[9px] font-extrabold block text-center text-sky-800">
                  {isFullScreenBrowser ? 'Normal' : 'Full'}
                </span>
              </button>

              {/* Mode Foto Katalog NSA / Vektor Flat */}
              {productType === 'tshirt' && (
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = mockupMode === 'vector' ? 'photo' : 'vector';
                    setMockupMode(nextMode);
                    showToast(nextMode === 'photo' ? 'Mode Foto Produk Asli NSA' : 'Mode Vektor 2D Flat (Tanpa Shadow)');
                  }}
                  className={`p-2 rounded-xl transition-colors cursor-pointer group ${
                    mockupMode === 'vector'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  title={mockupMode === 'vector' ? 'Mode: Vektor Flat (Klik untuk Foto Produk NSA)' : 'Mode: Foto Produk Asli NSA (Klik untuk Vektor Flat)'}
                >
                  <Shirt className="w-4 h-4 mx-auto group-hover:scale-110 transition-transform text-slate-700" />
                  <span className="text-[9px] font-extrabold block text-center">
                    {mockupMode === 'vector' ? 'Vektor' : 'Foto'}
                  </span>
                </button>
              )}

              <button
                onClick={() => handleOpenCaptureModal('guide')}
                className="p-2 hover:bg-amber-50 text-amber-700 rounded-xl transition-colors cursor-pointer group"
                title="Capture Gambar Real 1:1 Lengkap dengan Panduan Ukuran"
              >
                <Camera className="w-4 h-4 mx-auto text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="text-[9px] font-extrabold block text-center text-amber-800">Capture</span>
              </button>
            </div>

            {/* Floating Quick Action Toolbar for Selected Element */}
            {(() => {
              const activeSelectedElement = elements.find((el) => el.id === selectedElementId && el.angle === activeAngle);
              if (!activeSelectedElement) return null;
              return (
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-xs border border-slate-300 rounded-2xl px-3 py-1.5 shadow-lg text-xs animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="font-bold text-slate-800 text-[11px] truncate max-w-[130px]">
                      {activeSelectedElement.type === 'text'
                        ? `Teks: "${activeSelectedElement.text || ''}"`
                        : activeSelectedElement.type === 'image'
                        ? 'Gambar / Logo'
                        : `Clipart: ${activeSelectedElement.clipartName}`}
                    </span>
                  </div>

                  {/* Quick Center Button */}
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateElementPosition(activeSelectedElement.id, 50, activeSelectedElement.y);
                      showToast('Objek diposisikan tepat di tengah baju');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Posisikan tepat di tengah horizontal (Center X: 50%)"
                  >
                    <AlignCenter className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tengahkan</span>
                  </button>

                  {/* Quick Delete Button */}
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteElement(activeSelectedElement.id);
                      showToast('Objek berhasil dihapus dari baju');
                    }}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Hapus objek ini (Shortcut: tombol Delete / Backspace)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus Objek</span>
                  </button>
                </div>
              );
            })()}

            {/* Canvas Interactive Center */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
              <ApparelVectorMockup
                productType={productType}
                colorHex={selectedColor.hex}
                colorName={selectedColor.name}
                imageMockupUrl={selectedColor.imageMockupUrl}
                mockupMode={mockupMode}
                angle={activeAngle}
                showPrintAreaGuide={showPrintAreaGuide}
                elements={elements}
                selectedElementId={selectedElementId}
                onSelectElement={(id) => {
                  setSelectedElementId(id);
                  const found = elements.find((el) => el.id === id);
                  if (found?.type === 'image') {
                    setActiveTool('upload');
                  }
                }}
                onUpdateElementPosition={handleUpdateElementPosition}
                onUpdateElementSize={handleUpdateElementSize}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                scale={zoomLevel}
                selectedSize={selectedSize}
                showGarmentMeasurements={showGarmentMeasurements}
                isScale1to1={isScale1to1Active}
              />
            </div>

            {/* Bottom Floating Toast */}
            {toastMessage && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{toastMessage}</span>
              </div>
            )}
          </div>

          {/* =====================================================================
              4. RIGHTMOST VIEW ANGLE THUMBNAILS (matching Images 2, 3, 4)
          ===================================================================== */}
          <div className="w-28 bg-white border-l border-slate-200 flex flex-col items-center py-3 px-2 gap-2.5 shrink-0 z-10 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
              Sudut Pandang
            </span>

            {/* Quick Preview 2 Sisi Button */}
            <button
              type="button"
              onClick={() => setShowDualPreview(true)}
              className="w-full py-2 px-1 rounded-2xl border-2 border-purple-200 hover:border-purple-600 bg-purple-50 hover:bg-purple-100 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shadow-xs group"
              title="Lihat Gambar Depan dan Belakang Sekaligus"
            >
              <Eye className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-extrabold text-purple-950 text-center leading-tight">
                Preview 2 Sisi
              </span>
            </button>

            {[
              { id: 'depan', label: 'Depan' },
              { id: 'belakang', label: 'Belakang' },
              { id: 'lengan-kiri', label: 'Lengan Kiri' },
              { id: 'lengan-kanan', label: 'Lengan Kanan' },
              { id: 'label', label: 'Label' }
            ].map((angleItem) => {
              const isAngleActive = activeAngle === angleItem.id;
              return (
                <div
                  key={angleItem.id}
                  onClick={() => setActiveAngle(angleItem.id as ViewAngle)}
                  className={`w-full rounded-2xl border-2 p-1.5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-150 group ${
                    isAngleActive
                      ? 'border-[#00871f] bg-emerald-50/50 shadow-sm scale-102'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  {/* Miniature Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
                    <div className="w-14 h-14 pointer-events-none">
                      <ApparelVectorMockup
                        productType={productType}
                        colorHex={selectedColor.hex}
                        colorName={selectedColor.name}
                        imageMockupUrl={selectedColor.imageMockupUrl}
                        mockupMode={mockupMode}
                        angle={angleItem.id as ViewAngle}
                        showPrintAreaGuide={false}
                        elements={elements}
                        scale={0.9}
                      />
                    </div>
                  </div>
                  <span
                    className={`text-[10.5px] font-bold text-center leading-tight ${
                      isAngleActive ? 'text-[#00871f]' : 'text-slate-700 group-hover:text-slate-900'
                    }`}
                  >
                    {angleItem.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          PANDUAN UKURAN (SIZE CHART) MODAL (Image 5)
      ========================================================================= */}
      <SizeChartModal
        isOpen={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        initialProductType={productType}
      />

      {/* =========================================================================
          PRODUCT SELECTOR MODAL (Image 1: T-Shirt, Polo, Hoodie, Jersey)
      ========================================================================= */}
      <ProductSelectorModal
        isOpen={showProductSelector}
        onClose={() => setShowProductSelector(false)}
        onSelectProduct={(newType) => {
          setProductType(newType);
          setShowProductSelector(false);
          showToast(`Produk diganti ke: ${PRODUCT_CATALOG[newType].title}`);
        }}
      />

      {/* =========================================================================
          CAPTURE GAMBAR SKALA 1:1 & PANDUAN UKURAN MODAL
      ========================================================================= */}
      <CaptureModal
        isOpen={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        capturedImageUrl={capturedImageMockup}
        capturedImageUrlWithGuide={capturedImageGuide}
        productConfig={currentConfig}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        activeAngle={activeAngle}
        onCaptureAgain={handleCaptureAgain}
        isCapturing={isCapturingImage}
      />

      {/* =========================================================================
          3. DUAL PREVIEW MODAL (PREVIEW GAMBAR DEPAN & BELAKANG)
      ========================================================================= */}
      <DualPreviewModal
        isOpen={showDualPreview}
        onClose={() => setShowDualPreview(false)}
        productConfig={currentConfig}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        elements={elements}
        onSelectAngleAndEdit={(angle) => {
          setActiveAngle(angle);
          setShowDualPreview(false);
        }}
      />
    </div>
  );
};
