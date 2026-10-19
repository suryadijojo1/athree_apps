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
  Eye,
  FileCheck,
  LogOut
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
import { compressImage } from '../../utils/imageCompressor';

type SidebarTool =
  | 'product'
  | 'upload'
  | 'text'
  | 'clipart'
  | 'layer'
  | 'template'
  | 'help';

interface DesignStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductType?: ProductType;
  onApplyToInvoice?: (mockupDataUrl: string) => void;
  isInvoiceMode?: boolean;
  isDedicatedDesignUser?: boolean;
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

  // Modals inside Studio
  const [showSizeChart, setShowSizeChart] = useState<boolean>(false);
  const [showProductSelector, setShowProductSelector] = useState<boolean>(Boolean(startWithSelector));

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
          const newEl: DesignElement = {
            id: `img-${Date.now()}`,
            type: 'image',
            angle: activeAngle,
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            rotation: 0,
            scale: 1,
            src: dataUrl
          };
          pushHistory([...elements, newEl]);
          setSelectedElementId(newEl.id);
          showToast('Gambar / Logo berhasil ditambahkan!');
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Export Mockup Canvas to Image
  const generateMockupImage = async (): Promise<string> => {
    const svgEl = document.getElementById('apparel-mockup-svg');
    if (!svgEl) throw new Error('SVG Mockup tidak ditemukan');

    const svgXml = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = window.URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.URL.revokeObjectURL(blobURL);
          return reject(new Error('Canvas context gagal'));
        }

        // Fill background white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 800, 800);
        ctx.drawImage(image, 50, 50, 700, 700);

        window.URL.revokeObjectURL(blobURL);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        // Compress cleanly for lightweight Firestore / app payload (<100KB)
        const compressed = await compressImage(dataUrl, 800, 800, 0.7);
        resolve(compressed.dataUrl);
      };
      image.onerror = () => {
        window.URL.revokeObjectURL(blobURL);
        reject(new Error('Gagal merender mockup image'));
      };
      image.src = blobURL;
    });
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
      const mockupUrl = await generateMockupImage();
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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-3xl w-full max-w-[1400px] h-[95vh] max-h-[900px] shadow-2xl border border-slate-700 flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150">
        {/* =========================================================================
            TOP NAV / HEADER
        ========================================================================= */}
        <header className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 gap-2">
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
            {/* Mulai Design Baru (Modal 4 Pilihan) */}
            <button
              onClick={() => setShowProductSelector(true)}
              className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              title="Pilihan Mulai Design: 1. Kaos T-Shirt, 2. Polo, 3. Hoodie, 4. Jersey"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Mulai Design</span>
            </button>

            <button
              onClick={() => setShowSizeChart(true)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer relative"
              title="Lihat tabel ukuran asli 1:1 (LD, P, L)"
            >
              <Ruler className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Panduan Ukuran</span>
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
              <span className="hidden md:inline">Download</span>
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

            <button
              onClick={() => {
                if (isDedicatedDesignUser) {
                  setShowProductSelector(true);
                } else {
                  onClose();
                }
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title={isDedicatedDesignUser ? 'Mulai Desain Baru' : 'Tutup Studio'}
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

            {/* 2B. UPLOAD IMAGE TAB */}
            {activeTool === 'upload' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Upload Logo / Gambar</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tambahkan logo, desain DTF, atau sablon ke pakaian
                  </p>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-[#00871f] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/70 hover:bg-emerald-50/40"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#00871f] flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-800 block">Klik untuk Upload File</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    PNG, JPG, SVG transparan didukung (Maks. 10 MB)
                  </span>
                </div>

                {/* Paste from Clipboard reminder */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#00871f]" />
                    Tips Cepat:
                  </p>
                  <p className="text-slate-600">
                    Kamu bisa langsung tekan <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold">Ctrl + V</kbd> untuk menempelkan gambar screenshot / logo langsung ke baju.
                  </p>
                </div>
              </div>
            )}

            {/* 2C. ADD TEXT TAB */}
            {activeTool === 'text' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Tambah Teks Kustom</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ketik kata atau kalimat untuk dicetak di baju
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Isi Teks:</label>
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

            {/* 2F. TEMPLATE TAB */}
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

            {/* 2G. HELP TAB */}
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
                  3. <strong>Area Cetak</strong>: Garis putus-putus hijau menandakan batasan area cetak DTF / sablon maksimal 1:1.
                </p>
                <p>
                  4. <strong>Gunakan di Invoice</strong>: Klik tombol hijau di pojok kanan atas untuk langsung menyimpan mockup ke pesanan faktur saat ini.
                </p>
              </div>
            )}
          </div>

          {/* =====================================================================
              3. CENTER MAIN CANVAS AREA (matching Images 2, 3, 4)
          ===================================================================== */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-100">
            {/* Top Canvas Floating Controls (Undo, Redo, Zoom) matching Images 2, 3, 4 */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-2xl p-1.5 shadow-md text-xs">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-2 hover:bg-slate-100 text-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"
                title="Undo (Ctrl + Z)"
              >
                <Undo2 className="w-4 h-4" />
                <span className="text-[9px] font-bold block text-center">Undo</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 hover:bg-slate-100 text-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"
                title="Redo (Ctrl + Y)"
              >
                <Redo2 className="w-4 h-4" />
                <span className="text-[9px] font-bold block text-center">Redo</span>
              </button>
              <div className="h-px bg-slate-200 my-0.5" />
              <button
                onClick={() => setZoomLevel((z) => Math.min(2, z + 0.15))}
                className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Perbesar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
                <span className="text-[9px] font-bold block text-center">Perbesar</span>
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                className="p-2 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Perkecil Zoom"
              >
                <ZoomOut className="w-4 h-4" />
                <span className="text-[9px] font-bold block text-center">Perkecil</span>
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors cursor-pointer"
                title="Reset Zoom (100%)"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[9px] font-bold block text-center">Reset</span>
              </button>
            </div>

            {/* Canvas Interactive Center */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
              <ApparelVectorMockup
                productType={productType}
                colorHex={selectedColor.hex}
                angle={activeAngle}
                showPrintAreaGuide={showPrintAreaGuide}
                elements={elements}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                scale={zoomLevel}
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
          <div className="w-28 bg-white border-l border-slate-200 flex flex-col items-center py-4 px-2 gap-3 shrink-0 z-10 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
              Sudut Pandang
            </span>

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
    </div>
  );
};
