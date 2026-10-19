export type ProductType = 'tshirt' | 'polo' | 'hoodie' | 'jersey';

export type ViewAngle = 'depan' | 'belakang' | 'lengan-kiri' | 'lengan-kanan' | 'label';

export interface ApparelColor {
  name: string;
  hex: string;
  border?: string;
  textColor?: string;
}

export interface SizeChartRow {
  size: string;
  lebarDada: number;
  panjang: number;
  lengan: number;
}

export interface ProductConfig {
  id: ProductType;
  title: string;
  fullName: string;
  categoryLabel: string;
  productCountLabel: string;
  description: string;
  defaultColor: ApparelColor;
  availableSizes: string[];
  specs: string[];
  sizeChart: SizeChartRow[];
  sizeChartNote: string;
  colors: ApparelColor[];
  printAreaLabel: string;
}

export interface DesignElement {
  id: string;
  type: 'text' | 'image' | 'clipart';
  angle: ViewAngle;
  x: number; // percentage (0 - 100) relative to print area
  y: number; // percentage (0 - 100) relative to print area
  width: number; // px or %
  height: number;
  rotation: number;
  scale: number;
  // Text specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fill?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  // Image / clipart specific
  src?: string;
  clipartName?: string;
}

export const COMMON_COLORS: ApparelColor[] = [
  { name: 'Salmon', hex: '#E07A5F' },
  { name: 'Hitam', hex: '#1E1E1E' },
  { name: 'Putih', hex: '#FFFFFF', border: '#D1D5DB', textColor: '#111827' },
  { name: 'Abu Misty', hex: '#B0B0B0' },
  { name: 'Charcoal Grey', hex: '#4B5563' },
  { name: 'Navy', hex: '#1E293B' },
  { name: 'Maroon', hex: '#701A24' },
  { name: 'Merah Cabe', hex: '#DC2626' },
  { name: 'Royal Blue', hex: '#1D4ED8' },
  { name: 'Hijau Botol', hex: '#15803D' },
  { name: 'Lime Green', hex: '#84CC16' },
  { name: 'Kuning Kenari', hex: '#FACC15' },
  { name: 'Hijau Army', hex: '#4D5D3A' },
  { name: 'Orange', hex: '#EA580C' },
  { name: 'Cokelat Kopi', hex: '#4A2E1B' },
  { name: 'Lilac', hex: '#C084FC' },
  { name: 'Light Pink', hex: '#F472B6' },
  { name: 'Ungu Tua', hex: '#6B21A8' },
  { name: 'Biru Muda (Sky)', hex: '#38BDF8' },
  { name: 'Teal Blue', hex: '#0D9488' },
  { name: 'Olive Green', hex: '#65A30D' },
  { name: 'Khaki / Cream', hex: '#D6C7A1' },
  { name: 'Mustard', hex: '#CA8A04' }
];

export const PRODUCT_CATALOG: Record<ProductType, ProductConfig> = {
  tshirt: {
    id: 'tshirt',
    title: 'T-Shirts',
    fullName: 'New States Apparel Classic & Softstyle T-Shirt 7200',
    categoryLabel: 'T-Shirts',
    productCountLabel: '8 Produk',
    description:
      'Kaos polos lengan pendek dengan potongan reguler fit yang sangat nyaman dan tidak ketat. Dibuat dari katun combed ring-spun halus yang adem, menyerap keringat, dan cocok untuk sablon DTF maupun manual.',
    defaultColor: { name: 'Salmon', hex: '#E07A5F' },
    availableSizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
    specs: [
      '100% cotton ring spun preshrunk jersey knit.',
      '50% Cotton, 50% Polyester for Heather colors.',
      '90% Cotton, 10% Polyester for Sport Grey color.',
      '180g/m2.',
      'Single needle 2.2 cm collar.',
      'Taped neck and shoulders.',
      'Tubular construction.',
      'Double needle sleeve and bottom hems.',
      'Quarter-turned to eliminate centre crease.'
    ],
    sizeChart: [
      { size: 'S', lebarDada: 47, panjang: 67, lengan: 19 },
      { size: 'M', lebarDada: 50, panjang: 70, lengan: 19.5 },
      { size: 'L', lebarDada: 53, panjang: 73, lengan: 20 },
      { size: 'XL', lebarDada: 56, panjang: 75, lengan: 20.5 },
      { size: '2XL', lebarDada: 59, panjang: 77, lengan: 21 },
      { size: '3XL', lebarDada: 62, panjang: 80, lengan: 21.5 },
      { size: '4XL', lebarDada: 65, panjang: 83, lengan: 22 },
      { size: '5XL', lebarDada: 68, panjang: 86, lengan: 22.5 }
    ],
    sizeChartNote: 'Toleransi ukuran 1 – 2,5 cm',
    colors: COMMON_COLORS,
    printAreaLabel: 'Area Cetak DTF / Sablon (Maks. A3: 30 x 42 cm)'
  },
  polo: {
    id: 'polo',
    title: 'Polo T-Shirt',
    fullName: 'New States Apparel Easy Care Polo Shirt 8165',
    categoryLabel: 'Polo T-Shirt',
    productCountLabel: '2 Produk',
    description:
      'Made from lightweight ring-spun cotton, this polo shirt offers a noticeably softer and more comfortable feel. It features a regular fit that sits nicely without feeling tight. A versatile choice for relaxed days or clean, casual looks.',
    defaultColor: { name: 'Maroon', hex: '#701A24' },
    availableSizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    specs: [
      '200 Gsm Pique fabric high durability.',
      '35% Cotton / 65% Polyester premium blend.',
      'Satin Label halus di leher.',
      'Clean finished placket with reinforced bottom box.',
      '3 color-matched buttons with reinforced buttonholes.',
      'Ribbed knit collar and sleeve cuffs.'
    ],
    sizeChart: [
      { size: 'S', lebarDada: 48, panjang: 68, lengan: 20 },
      { size: 'M', lebarDada: 51, panjang: 71, lengan: 21 },
      { size: 'L', lebarDada: 54, panjang: 74, lengan: 22 },
      { size: 'XL', lebarDada: 57, panjang: 76, lengan: 23 },
      { size: '2XL', lebarDada: 60, panjang: 78, lengan: 24 },
      { size: '3XL', lebarDada: 63, panjang: 81, lengan: 25 }
    ],
    sizeChartNote: 'Toleransi ukuran 1 – 2 cm',
    colors: [
      { name: 'Maroon', hex: '#701A24' },
      { name: 'Hitam', hex: '#1E1E1E' },
      { name: 'Putih', hex: '#FFFFFF', border: '#D1D5DB', textColor: '#111827' },
      { name: 'Navy', hex: '#1E293B' },
      { name: 'Charcoal Grey', hex: '#4B5563' },
      { name: 'Royal Blue', hex: '#1D4ED8' },
      { name: 'Merah Cabe', hex: '#DC2626' },
      { name: 'Hijau Botol', hex: '#15803D' },
      { name: 'Kuning Kenari', hex: '#FACC15' },
      { name: 'Orange', hex: '#EA580C' },
      { name: 'Lilac', hex: '#C084FC' },
      { name: 'Hijau Army', hex: '#4D5D3A' },
      { name: 'Khaki', hex: '#D6C7A1' },
      { name: 'Sky Blue', hex: '#38BDF8' }
    ],
    printAreaLabel: 'Area Cetak Bordir / DTF (Dada Kiri: 10 x 10 cm, Punggung: 28 x 35 cm)'
  },
  hoodie: {
    id: 'hoodie',
    title: 'Jacket & Hoodies',
    fullName: 'New States Apparel Super Blend Hooded Sweatshirt 9500',
    categoryLabel: 'Jacket & Hoodies',
    productCountLabel: '6 Produk',
    description:
      'Made from heavyweight preshrunk fleece knit, this hoodie offers a noticeably warmer, softer, and more comfortable feel. It features a relaxed fit with a double-lined hood and roomy kangaroo pocket.',
    defaultColor: { name: 'Lilac', hex: '#C084FC' },
    availableSizes: ['S', 'M', 'L', 'XL', '2XL'],
    specs: [
      '50% Cotton / 50% Polyester (80% Cotton / 20% Polyester for Camo Series).',
      '270 g/m² Preshrunk fleece knit (210 g/m² for Camo Series).',
      'Air jet yarn = softer feel and reduced pilling.',
      'Double-lined hood with color-matched drawcord.',
      'Pouch pocket (Kangaroo Pocket) depan.',
      'Double needle stitching at waistband and cuffs.',
      '1x1 athletic rib with spandex for comfortable stretch.'
    ],
    sizeChart: [
      { size: 'S', lebarDada: 51, panjang: 65, lengan: 60 },
      { size: 'M', lebarDada: 53, panjang: 67, lengan: 61 },
      { size: 'L', lebarDada: 56, panjang: 70, lengan: 62 },
      { size: 'XL', lebarDada: 61, panjang: 73, lengan: 63 },
      { size: '2XL', lebarDada: 64, panjang: 76, lengan: 64 }
    ],
    sizeChartNote: 'Toleransi ukuran 1 – 2,5 cm',
    colors: [
      { name: 'Lilac', hex: '#C084FC' },
      { name: 'Hitam', hex: '#1E1E1E' },
      { name: 'Putih', hex: '#FFFFFF', border: '#D1D5DB', textColor: '#111827' },
      { name: 'Abu Misty', hex: '#B0B0B0' },
      { name: 'Charcoal Grey', hex: '#4B5563' },
      { name: 'Navy', hex: '#1E293B' },
      { name: 'Maroon', hex: '#701A24' },
      { name: 'Hijau Army', hex: '#4D5D3A' },
      { name: 'Hijau Botol', hex: '#15803D' },
      { name: 'Merah Cabe', hex: '#DC2626' },
      { name: 'Royal Blue', hex: '#1D4ED8' },
      { name: 'Kuning Mustard', hex: '#CA8A04' },
      { name: 'Light Pink', hex: '#F472B6' },
      { name: 'Cokelat Kopi', hex: '#4A2E1B' }
    ],
    printAreaLabel: 'Area Cetak Sablon / DTF (Dada: 28 x 20 cm, Punggung: 30 x 40 cm)'
  },
  jersey: {
    id: 'jersey',
    title: 'Sport T-Shirts',
    fullName: 'Active Performance Sport Dry-Fit Jersey 7200',
    categoryLabel: 'Sport T-Shirts',
    productCountLabel: '3 Produk',
    description:
      'Jersey olahraga berbahan microfiber dry-fit berpori halus yang sangat sejuk, cepat menyerap & mengeringkan keringat, dan anti-bakteri. Sangat pas untuk seragam futsal, sepak bola, running, badminton, dan komunitas sepeda.',
    defaultColor: { name: 'Putih', hex: '#FFFFFF', border: '#D1D5DB', textColor: '#111827' },
    availableSizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    specs: [
      '100% Microfiber Polyester Dry-Fit Mesh.',
      '150 g/m² ultra-lightweight and breathable.',
      'Quick-dry & moisture wicking technology.',
      'Anti-bacterial treatment to prevent sweat odor.',
      'Sublimation full-print & DTF heat press friendly.',
      'Raglan sport sleeve cut for maximum movement.',
      'Reinforced double-stitch hem and collar.'
    ],
    sizeChart: [
      { size: 'S', lebarDada: 48, panjang: 68, lengan: 20 },
      { size: 'M', lebarDada: 51, panjang: 70, lengan: 21 },
      { size: 'L', lebarDada: 54, panjang: 73, lengan: 22 },
      { size: 'XL', lebarDada: 57, panjang: 75, lengan: 23 },
      { size: '2XL', lebarDada: 60, panjang: 77, lengan: 24 },
      { size: '3XL', lebarDada: 63, panjang: 80, lengan: 25 }
    ],
    sizeChartNote: 'Toleransi ukuran 1 – 2 cm',
    colors: [
      { name: 'Putih', hex: '#FFFFFF', border: '#D1D5DB', textColor: '#111827' },
      { name: 'Hitam', hex: '#1E1E1E' },
      { name: 'Royal Blue', hex: '#1D4ED8' },
      { name: 'Merah Cabe', hex: '#DC2626' },
      { name: 'Navy', hex: '#1E293B' },
      { name: 'Neon Lime', hex: '#84CC16' },
      { name: 'Kuning Kenari', hex: '#FACC15' },
      { name: 'Orange Sport', hex: '#EA580C' },
      { name: 'Abu Sport', hex: '#9CA3AF' },
      { name: 'Hijau Tosca', hex: '#0D9488' }
    ],
    printAreaLabel: 'Area Cetak Sublim / DTF (Depan Full / Dada & Nomor Punggung)'
  }
};
