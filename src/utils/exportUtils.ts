import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Product, CashFlowRecord, KaosStockItem } from '../types';

export const formatCurrency = (val: number): string => {
  return 'Rp ' + (val || 0).toLocaleString('id-ID');
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

/**
 * Export Sales Report to Excel (.xlsx)
 */
export const exportSalesToExcel = (
  transactions: Transaction[],
  title = 'Laporan_Penjualan_Harian',
  cashFlows?: CashFlowRecord[],
  isAdmin = false
) => {
  const data = transactions.map((t, idx) => {
    const row: Record<string, any> = {
      No: idx + 1,
      'No Faktur': t.invoiceNo,
      'Tanggal Transaksi': t.date,
      'Jatuh Tempo Selesai': t.dueDate || '-',
      Pelanggan: t.customer.name,
      'Tipe Order': t.orderType,
      'Total Item': t.items.reduce((sum, item) => sum + item.quantity, 0),
      Subtotal: t.subtotal,
      Diskon: t.discount,
      'Total Penjualan': t.total,
      'Sisa Pembayaran Piutang': t.remainingAmount || 0,
      'Tanggal Pembayaran Piutang':
        t.piutangPaidDate ||
        (t.piutangPayments && t.piutangPayments.length > 0
          ? t.piutangPayments[t.piutangPayments.length - 1].date
          : t.dueDate || '-'),
      'Status Pembayaran':
        t.paymentStatus ||
        (t.remainingAmount && t.remainingAmount > 0 ? 'PIUTANG' : 'LUNAS')
    };

    // Rincian biaya dan keuntungan hanya disertakan jika diunduh oleh Admin / Owner
    if (isAdmin) {
      row['Biaya Vendor'] = t.vendorCost || 0;
      row['Biaya Pengiriman'] = t.shippingCost || 0;
      row['Hasil Keuntungan'] = t.total - ((t.vendorCost || 0) + (t.shippingCost || 0));
    }

    row['Metode Bayar'] = t.paymentMethod;
    row['Status'] = t.status;
    row['Kasir'] = t.cashierName;
    row['Catatan'] = t.notes || '-';
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan');

  // If cash flow records are present, add second sheet
  if (cashFlows && cashFlows.length > 0) {
    const cashFlowData = cashFlows.map((c, idx) => ({
      No: idx + 1,
      Tanggal: c.date,
      Tipe: c.type === 'INCOME' ? 'PENDAPATAN LAIN (+)' : 'PENGELUARAN TOKO (-)',
      Kategori: c.category,
      'Metode Kas': c.type === 'INCOME' ? (c.paymentMethod === 'TRANSFER' ? 'Transfer Bank (Non-Kas)' : 'Tunai (Kas)') : 'Tunai Kas Toko',
      Keterangan: c.description,
      'Nominal (Rp)': c.type === 'INCOME' ? c.amount : -c.amount,
      'Dicatat Oleh': c.recordedBy
    }));
    const cashFlowWorksheet = XLSX.utils.json_to_sheet(cashFlowData);
    XLSX.utils.book_append_sheet(workbook, cashFlowWorksheet, 'Arus Kas & Pengeluaran');
  }

  // Generate and download
  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${title}_${dateTag}.xlsx`);
};

/**
 * Export Sales Report to PDF
 */
export const exportSalesToPDF = (
  transactions: Transaction[],
  periodTitle = 'Laporan Penjualan Harian',
  cashFlows?: CashFlowRecord[]
) => {
  const doc = new jsPDF('landscape');

  // Header
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text('ATHREE STUDIO JAYAPURA', 14, 16);

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(`${periodTitle}`, 14, 23);
  doc.setFontSize(10);
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 29);

  // Summary Metrics
  const totalRevenue = transactions.reduce((acc, t) => acc + t.total, 0);
  const totalOrders = transactions.length;
  const incomeTotal = (cashFlows || [])
    .filter((c) => c.type === 'INCOME')
    .reduce((sum, c) => sum + c.amount, 0);
  const expenseTotal = (cashFlows || [])
    .filter((c) => c.type === 'EXPENSE')
    .reduce((sum, c) => sum + c.amount, 0);
  const netOmset = totalRevenue + incomeTotal - expenseTotal;

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  let summaryText = `Total Transaksi: ${totalOrders} | Penjualan: ${formatCurrency(totalRevenue)}`;
  if (incomeTotal > 0 || expenseTotal > 0) {
    summaryText += ` | (+) Pendapatan Lain: ${formatCurrency(incomeTotal)} | (-) Pengeluaran: ${formatCurrency(expenseTotal)} | (=) Omset Bersih: ${formatCurrency(netOmset)}`;
  }
  doc.text(summaryText, 14, 35);

  // Table
  const tableData = transactions.map((t, idx) => [
    idx + 1,
    t.invoiceNo,
    t.date,
    t.customer.name,
    t.orderType,
    t.items.map((i) => `${i.name} (x${i.quantity})`).join(', '),
    formatCurrency(t.total),
    t.remainingAmount && t.remainingAmount > 0 ? formatCurrency(t.remainingAmount) : '-',
    t.piutangPaidDate ||
      (t.piutangPayments && t.piutangPayments.length > 0
        ? t.piutangPayments[t.piutangPayments.length - 1].date
        : t.dueDate || '-'),
    t.paymentMethod,
    t.status
  ]);

  autoTable(doc, {
    startY: 40,
    head: [
      [
        'No',
        'Faktur',
        'Tgl Order',
        'Pelanggan',
        'Tipe',
        'Rincian Item',
        'Total',
        'Sisa Piutang',
        'Tgl Bayar/Tempo',
        'Metode',
        'Status'
      ]
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Penjualan_${dateTag}.pdf`);
};

/**
 * Export Inventory / Stock to Excel
 */
export const exportStockToExcel = (products: Product[]) => {
  const data = products.map((p, idx) => ({
    No: idx + 1,
    SKU: p.sku,
    'Nama Barang': p.name,
    Kategori: p.category,
    'Harga Jual': p.price,
    'Stok Saat Ini': p.stock,
    'Stok Minimal': p.minStock,
    Satuan: p.unit,
    Status: p.stock <= 0 ? 'Habis' : p.stock <= p.minStock ? 'Menipis' : 'Aman',
    'Total Nilai Jual Stok': p.stock * p.price
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok Barang');

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Manajemen_Stok_Barang_${dateTag}.xlsx`);
};

/**
 * Export Inventory to PDF
 */
export const exportStockToPDF = (products: Product[]) => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('ATHREE STUDIO JAYAPURA - LAPORAN STOK BARANG', 14, 15);
  doc.setFontSize(10);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);

  const totalStockValue = products.reduce((acc, p) => acc + p.stock * p.price, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  doc.text(
    `Total Produk: ${products.length} item | Stok Menipis/Habis: ${lowStockCount} item | Total Nilai Stok: ${formatCurrency(totalStockValue)}`,
    14,
    28
  );

  const tableData = products.map((p, idx) => [
    idx + 1,
    p.sku,
    p.name,
    p.category,
    formatCurrency(p.price),
    `${p.stock} ${p.unit}`,
    p.stock <= 0 ? 'HABIS' : p.stock <= p.minStock ? 'MENIPIS' : 'AMAN'
  ]);

  autoTable(doc, {
    startY: 34,
    head: [['No', 'SKU', 'Nama Barang', 'Kategori', 'Harga Jual', 'Stok', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontSize: 8
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    }
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Stok_${dateTag}.pdf`);
};

/**
 * Export Kaos Polos Stock to Excel (.xlsx)
 */
export const exportKaosStockToExcel = (kaosStocks: KaosStockItem[]) => {
  const data = kaosStocks.map((k, idx) => ({
    No: idx + 1,
    SKU: `KAOS-${k.color.toUpperCase().replace(/\s+/g, '-')}-${k.size.toUpperCase()}`,
    'Warna Kaos': k.color,
    'Ukuran / Size': k.size,
    'Stok Saat Ini (Pcs)': k.stock,
    'Stok Minimal (Pcs)': k.minStock,
    Status: k.stock <= 0 ? 'HABIS' : k.stock <= k.minStock ? 'MENIPIS' : 'AMAN'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok Kaos Polos');

  // Generate Matrix Summary Sheet (Warna vs Size)
  const colors = Array.from(new Set(kaosStocks.map((k) => k.color)));
  const sizes = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
  
  const matrixData = colors.map((col, idx) => {
    const row: Record<string, any> = {
      No: idx + 1,
      'Warna Kaos': col
    };
    let totalPerColor = 0;
    sizes.forEach((sz) => {
      const found = kaosStocks.find((k) => k.color.toLowerCase() === col.toLowerCase() && k.size.toUpperCase() === sz.toUpperCase());
      const qty = found ? found.stock : 0;
      row[sz] = qty;
      totalPerColor += qty;
    });
    row['Total (Pcs)'] = totalPerColor;
    return row;
  });

  const matrixSheet = XLSX.utils.json_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(workbook, matrixSheet, 'Matriks Per Warna');

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Manajemen_Stok_Kaos_Polos_${dateTag}.xlsx`);
};

/**
 * Export Kaos Polos Stock to PDF
 */
export const exportKaosStockToPDF = (kaosStocks: KaosStockItem[]) => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('ATHREE STUDIO / DEAZBAR - STOK KHUSUS KAOS POLOS', 14, 15);
  doc.setFontSize(10);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);

  const totalPcs = kaosStocks.reduce((sum, k) => sum + k.stock, 0);
  const lowStockCount = kaosStocks.filter((k) => k.stock <= k.minStock).length;
  doc.text(
    `Total Stok Fisik: ${totalPcs} Pcs | Total Varian: ${kaosStocks.length} | Perhatian (Menipis/Habis): ${lowStockCount} varian`,
    14,
    28
  );

  const tableData = kaosStocks.map((k, idx) => [
    idx + 1,
    `KAOS-${k.color.toUpperCase().replace(/\s+/g, '-')}-${k.size}`,
    k.color,
    k.size,
    `${k.stock} Pcs`,
    `${k.minStock} Pcs`,
    k.stock <= 0 ? 'HABIS' : k.stock <= k.minStock ? 'MENIPIS' : 'AMAN'
  ]);

  autoTable(doc, {
    startY: 34,
    head: [['No', 'SKU Kaos', 'Warna', 'Size', 'Stok Saat Ini', 'Min. Stok', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 8
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    }
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Stok_Kaos_${dateTag}.pdf`);
};

/**
 * Generate Printable Receipt PDF
 */
export const downloadTransactionReceiptPDF = (transaction: Transaction) => {
  // Thermal 80mm width paper simulated in PDF
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 190]
  });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ATHREE STUDIO JAYAPURA', 40, 10, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Custom Jersey, Sablon & Merchandise', 40, 14, { align: 'center' });
  doc.text('Jl. Raya Abepura - Jayapura', 40, 18, { align: 'center' });
  doc.text('Telp/WA: 0812-4899-2311', 40, 22, { align: 'center' });

  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 25, 75, 25);

  let y = 30;
  doc.setFontSize(8);
  doc.text(`No Faktur  : ${transaction.invoiceNo}`, 5, y);
  y += 4;
  doc.text(`Tanggal    : ${transaction.date}`, 5, y);
  y += 4;
  // Jatuh Tempo Penyelesaian highlighted
  doc.setFont('helvetica', 'bold');
  doc.text(`Jatuh Tempo: ${transaction.dueDate || 'Langsung Selesai'}`, 5, y);
  doc.setFont('helvetica', 'normal');
  y += 4;
  doc.text(`Pelanggan  : ${transaction.customer.name}`, 5, y);
  y += 4;
  doc.text(`Kasir      : ${transaction.cashierName}`, 5, y);
  y += 4;
  doc.text(`Tipe Order : ${transaction.orderType}`, 5, y);

  y += 3;
  doc.line(5, y, 75, y);
  y += 4;

  // Items
  transaction.items.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.text(item.name.substring(0, 26), 5, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.quantity} x ${formatCurrency(item.price)}`, 5, y);
    doc.text(formatCurrency(item.subtotal), 75, y, { align: 'right' });
    y += 4;
    if (item.kaosColor || item.kaosSize) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`[Kaos: ${item.kaosColor || '-'} | Size: ${item.kaosSize || '-'}]`, 5, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      y += 3.5;
    }
    if (item.notes) {
      doc.setFontSize(7);
      doc.text(`* ${item.notes.substring(0, 32)}`, 5, y);
      doc.setFontSize(8);
      y += 3.5;
    }
  });

  doc.line(5, y, 75, y);
  y += 4;

  doc.text('Subtotal:', 5, y);
  doc.text(formatCurrency(transaction.subtotal), 75, y, { align: 'right' });
  y += 4;

  if (transaction.discount > 0) {
    doc.text('Diskon:', 5, y);
    doc.text(`-${formatCurrency(transaction.discount)}`, 75, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL:', 5, y);
  doc.text(formatCurrency(transaction.total), 75, y, { align: 'right' });
  y += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.text(`Metode: ${transaction.paymentMethod}`, 5, y);
  y += 4;
  doc.text('Dibayar:', 5, y);
  doc.text(formatCurrency(transaction.amountPaid), 75, y, { align: 'right' });
  y += 4;

  if (transaction.remainingAmount && transaction.remainingAmount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Sisa Piutang:', 5, y);
    doc.text(formatCurrency(transaction.remainingAmount), 75, y, { align: 'right' });
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Jatuh Tempo: ${transaction.dueDate || 'Sesuai Deadline'}`, 5, y);
    doc.setFontSize(8);
    y += 4;
  } else {
    doc.text('Kembalian:', 5, y);
    doc.text(formatCurrency(transaction.change), 75, y, { align: 'right' });
    y += 4;
  }

  y += 5;
  doc.line(5, y, 75, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`STATUS: ${transaction.status.toUpperCase()}`, 40, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Terima kasih atas pesanan Anda!', 40, y, { align: 'center' });
  y += 3.5;
  doc.text('Harap simpan struk ini untuk pengambilan order', 40, y, { align: 'center' });

  doc.save(`Struk_${transaction.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};

/**
 * Download Sample Template for Product Import (Excel / CSV)
 */
export const downloadProductImportTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
  const sampleData = [
    {
      'SKU': 'JER-001',
      'Nama Produk': 'JERSEY DRYFIT SUBLIM PREMIUM',
      'Kategori': 'JERSEY',
      'Harga Jual': 135000,
      'Stok': 50,
      'Stok Minimum': 10,
      'Satuan': 'Pcs'
    },
    {
      'SKU': 'KAOS-002',
      'Nama Produk': 'KAOS POLOS COTTON COMBED 30S',
      'Kategori': 'KAOS POLOS',
      'Harga Jual': 65000,
      'Stok': 120,
      'Stok Minimum': 20,
      'Satuan': 'Pcs'
    },
    {
      'SKU': 'SAB-003',
      'Nama Produk': 'SABLON DTF HIGH DEFINITION A3',
      'Kategori': 'SABLON',
      'Harga Jual': 35000,
      'Stok': 200,
      'Stok Minimum': 25,
      'Satuan': 'Lembar'
    },
    {
      'SKU': 'STK-004',
      'Nama Produk': 'STIKER VINYL HOLOGRAM DIE CUT',
      'Kategori': 'AKSESORIS',
      'Harga Jual': 15000,
      'Stok': 150,
      'Stok Minimum': 30,
      'Satuan': 'Pcs'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Produk');

  if (format === 'csv') {
    XLSX.writeFile(workbook, 'Template_Import_Produk_Athree.csv', { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, 'Template_Import_Produk_Athree.xlsx', { bookType: 'xlsx' });
  }
};

/**
 * Download Template for Kaos Stock Adjustment / Opname Import (Excel / CSV)
 */
export const downloadKaosStockAdjustmentTemplate = (
  currentStocks?: KaosStockItem[],
  format: 'xlsx' | 'csv' = 'xlsx'
) => {
  // If currentStocks is provided, pre-fill with existing colors and sizes to make stock opname seamless
  const rows = (currentStocks && currentStocks.length > 0)
    ? currentStocks.map((k, idx) => ({
        'No': idx + 1,
        'Warna Kaos': k.color,
        'Ukuran': k.size,
        'Stok Fisik Opname': k.stock, // User can update this number
        'Stok Minimal': k.minStock || 5,
        'Keterangan': 'Hasil Stock Opname'
      }))
    : [
        { 'No': 1, 'Warna Kaos': 'Hitam', 'Ukuran': 'S', 'Stok Fisik Opname': 40, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' },
        { 'No': 2, 'Warna Kaos': 'Hitam', 'Ukuran': 'M', 'Stok Fisik Opname': 50, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' },
        { 'No': 3, 'Warna Kaos': 'Hitam', 'Ukuran': 'L', 'Stok Fisik Opname': 60, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' },
        { 'No': 4, 'Warna Kaos': 'Hitam', 'Ukuran': 'XL', 'Stok Fisik Opname': 35, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' },
        { 'No': 5, 'Warna Kaos': 'Putih', 'Ukuran': 'M', 'Stok Fisik Opname': 30, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' },
        { 'No': 6, 'Warna Kaos': 'Putih', 'Ukuran': 'L', 'Stok Fisik Opname': 45, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' },
        { 'No': 7, 'Warna Kaos': 'Navy', 'Ukuran': 'L', 'Stok Fisik Opname': 25, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' },
        { 'No': 8, 'Warna Kaos': 'Maroon', 'Ukuran': 'XL', 'Stok Fisik Opname': 20, 'Stok Minimal': 5, 'Keterangan': 'Opname Gudang' }
      ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Opname Kaos Polos');

  const dateTag = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    XLSX.writeFile(workbook, `Template_Penyesuaian_Stok_Kaos_${dateTag}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `Template_Penyesuaian_Stok_Kaos_${dateTag}.xlsx`, { bookType: 'xlsx' });
  }
};

export interface SalesProfitSummaryItem {
  salesName: string;
  orderCount: number;
  totalInvoice: number;
  vendorCost: number;
  shippingCost: number;
  profit: number;
  marginPercent: string;
}

/**
 * Export Sales Profit Report to Excel (.xlsx) with 2 sheets:
 * Sheet 1: Rekap Per Sales
 * Sheet 2: Rincian Faktur Penjualan
 */
export const exportSalesProfitToExcel = (
  summaryData: SalesProfitSummaryItem[],
  transactions: Transaction[],
  periodLabel: string
) => {
  // Sheet 1: Rekap Keuntungan Per Sales
  const summaryRows = summaryData.map((s, idx) => ({
    'No': idx + 1,
    'Petugas Sales': s.salesName,
    'Jumlah Faktur': s.orderCount,
    'Total Nilai Faktur (Rp)': s.totalInvoice,
    'Biaya Vendor (Rp)': s.vendorCost,
    'Biaya Pengiriman (Rp)': s.shippingCost,
    'Hasil Keuntungan (Rp)': s.profit,
    'Margin Keuntungan (%)': s.marginPercent + '%'
  }));

  // Add Grand Total row to Sheet 1
  const grandTotalInvoice = summaryData.reduce((acc, s) => acc + s.totalInvoice, 0);
  const grandVendorCost = summaryData.reduce((acc, s) => acc + s.vendorCost, 0);
  const grandShippingCost = summaryData.reduce((acc, s) => acc + s.shippingCost, 0);
  const grandProfit = grandTotalInvoice - (grandVendorCost + grandShippingCost);
  const grandMargin = grandTotalInvoice > 0 ? ((grandProfit / grandTotalInvoice) * 100).toFixed(1) : '0';

  summaryRows.push({
    'No': 'TOTAL' as any,
    'Petugas Sales': 'SEMUA SALES TERPILIH',
    'Jumlah Faktur': summaryData.reduce((acc, s) => acc + s.orderCount, 0),
    'Total Nilai Faktur (Rp)': grandTotalInvoice,
    'Biaya Vendor (Rp)': grandVendorCost,
    'Biaya Pengiriman (Rp)': grandShippingCost,
    'Hasil Keuntungan (Rp)': grandProfit,
    'Margin Keuntungan (%)': grandMargin + '%'
  });

  // Sheet 2: Rincian Faktur Transaksi
  const detailRows = transactions.map((t, idx) => {
    const vCost = t.vendorCost || 0;
    const sCost = t.shippingCost || 0;
    const profit = t.total - (vCost + sCost);
    const margin = t.total > 0 ? ((profit / t.total) * 100).toFixed(1) : '0';
    return {
      'No': idx + 1,
      'No Faktur': t.invoiceNo,
      'Tanggal': t.date,
      'Petugas Sales': t.orderType,
      'Pelanggan': t.customer.name,
      'Nama Vendor': t.vendorName || '-',
      'Total Nilai Faktur (Rp)': t.total,
      'Biaya Vendor (Rp)': vCost,
      'Biaya Pengiriman (Rp)': sCost,
      'Hasil Keuntungan (Rp)': profit,
      'Margin (%)': margin + '%',
      'Metode Bayar': t.paymentMethod,
      'Status': t.status
    };
  });

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const detailSheet = XLSX.utils.json_to_sheet(detailRows);

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Rekap Keuntungan Sales');
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Rincian Faktur');

  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `Laporan_Keuntungan_Sales_${cleanPeriod}_${Date.now()}.xlsx`);
};

/**
 * Export Sales Profit Report to PDF with Business Header & AutoTable
 */
export const exportSalesProfitToPDF = (
  summaryData: SalesProfitSummaryItem[],
  transactions: Transaction[],
  periodLabel: string,
  totalMetrics: {
    totalInvoice: number;
    vendorCost: number;
    shippingCost: number;
    profit: number;
    marginPercent: string;
  }
) => {
  const doc = new jsPDF('landscape');

  // Header
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('ATHREE STUDIO JAYAPURA', 14, 15);

  doc.setFontSize(12);
  doc.setTextColor(0, 135, 31);
  doc.text(`LAPORAN HASIL KEUNTUNGAN (PROFIT BERSIH) SELURUH SALES`, 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${periodLabel} | Dicetak: ${new Date().toLocaleString('id-ID')} | Khusus Akses Admin/Owner`, 14, 27);

  // Summary Metrics Box (matching the green card in screenshot)
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, 30, 268, 18, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Nilai Faktur: ${formatCurrency(totalMetrics.totalInvoice)}`, 18, 37);
  doc.setTextColor(225, 29, 72);
  doc.text(`Biaya Vendor: - ${formatCurrency(totalMetrics.vendorCost)}`, 85, 37);
  doc.text(`Biaya Kirim: - ${formatCurrency(totalMetrics.shippingCost)}`, 145, 37);
  doc.setTextColor(0, 135, 31);
  doc.setFont('helvetica', 'bold');
  doc.text(`Hasil Keuntungan: ${formatCurrency(totalMetrics.profit)} (Margin: ${totalMetrics.marginPercent}%)`, 200, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`* Rumus: Hasil Keuntungan = Total Nilai Faktur - (Biaya Vendor + Biaya Pengiriman). Sesuai ketentuan, hanya untuk Admin/Owner.`, 18, 44);

  // Table 1: Rekap Per Sales
  const summaryTableData = summaryData.map((s, idx) => [
    idx + 1,
    s.salesName,
    s.orderCount,
    formatCurrency(s.totalInvoice),
    formatCurrency(s.vendorCost),
    formatCurrency(s.shippingCost),
    formatCurrency(s.profit),
    `${s.marginPercent}%`
  ]);

  autoTable(doc, {
    startY: 52,
    head: [
      [
        'No',
        'Petugas Sales',
        'Jml Faktur',
        'Total Nilai Faktur',
        'Biaya Vendor',
        'Biaya Kirim',
        'Hasil Keuntungan',
        'Margin'
      ]
    ],
    body: summaryTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 135, 31],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    foot: [
      [
        'Total',
        'Semua Sales Terpilih',
        summaryData.reduce((acc, s) => acc + s.orderCount, 0),
        formatCurrency(totalMetrics.totalInvoice),
        formatCurrency(totalMetrics.vendorCost),
        formatCurrency(totalMetrics.shippingCost),
        formatCurrency(totalMetrics.profit),
        `${totalMetrics.marginPercent}%`
      ]
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8
    }
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Keuntungan_Sales_${dateTag}.pdf`);
};

