import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Product, CashFlowRecord } from '../types';

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
  cashFlows?: CashFlowRecord[]
) => {
  const data = transactions.map((t, idx) => ({
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
    'Metode Bayar': t.paymentMethod,
    Status: t.status,
    Kasir: t.cashierName,
    Catatan: t.notes || '-'
  }));

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
    t.dueDate || '-',
    t.customer.name,
    t.orderType,
    t.items.map((i) => `${i.name} (x${i.quantity})`).join(', '),
    formatCurrency(t.total),
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
        'Jatuh Tempo',
        'Pelanggan',
        'Tipe',
        'Rincian Item',
        'Total',
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
    'Harga Modal': p.costPrice,
    'Harga Jual': p.price,
    'Stok Saat Ini': p.stock,
    'Stok Minimal': p.minStock,
    Satuan: p.unit,
    Status: p.stock <= 0 ? 'Habis' : p.stock <= p.minStock ? 'Menipis' : 'Aman',
    'Total Aset (Nilai Modal)': p.stock * p.costPrice
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

  const totalAssets = products.reduce((acc, p) => acc + p.stock * p.costPrice, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  doc.text(
    `Total Produk: ${products.length} item | Stok Menipis/Habis: ${lowStockCount} item | Nilai Modal Aset: ${formatCurrency(totalAssets)}`,
    14,
    28
  );

  const tableData = products.map((p, idx) => [
    idx + 1,
    p.sku,
    p.name,
    p.category,
    formatCurrency(p.costPrice),
    formatCurrency(p.price),
    `${p.stock} ${p.unit}`,
    p.stock <= 0 ? 'HABIS' : p.stock <= p.minStock ? 'MENIPIS' : 'AMAN'
  ]);

  autoTable(doc, {
    startY: 34,
    head: [['No', 'SKU', 'Nama Barang', 'Kategori', 'Modal', 'Jual', 'Stok', 'Status']],
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
  doc.text('Kembalian:', 5, y);
  doc.text(formatCurrency(transaction.change), 75, y, { align: 'right' });

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
      'Harga Modal': 85000,
      'Stok': 50,
      'Stok Minimum': 10,
      'Satuan': 'Pcs'
    },
    {
      'SKU': 'KAOS-002',
      'Nama Produk': 'KAOS POLOS COTTON COMBED 30S',
      'Kategori': 'KAOS POLOS',
      'Harga Jual': 65000,
      'Harga Modal': 40000,
      'Stok': 120,
      'Stok Minimum': 20,
      'Satuan': 'Pcs'
    },
    {
      'SKU': 'SAB-003',
      'Nama Produk': 'SABLON DTF HIGH DEFINITION A3',
      'Kategori': 'SABLON',
      'Harga Jual': 35000,
      'Harga Modal': 18000,
      'Stok': 200,
      'Stok Minimum': 25,
      'Satuan': 'Lembar'
    },
    {
      'SKU': 'STK-004',
      'Nama Produk': 'STIKER VINYL HOLOGRAM DIE CUT',
      'Kategori': 'AKSESORIS',
      'Harga Jual': 15000,
      'Harga Modal': 7000,
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
