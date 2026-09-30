import { Transaction } from '../types';
import { formatCurrency } from './exportUtils';

export type PrintFormat = 'thermal80' | 'thermal58' | 'spk_a4';

/**
 * Generate HTML string for thermal receipt (80mm / 58mm) or SPK (A4)
 */
export function generateReceiptHTML(transaction: Transaction, format: PrintFormat = 'thermal80'): string {
  const isA4 = format === 'spk_a4';
  const is58 = format === 'thermal58';
  const widthStyle = isA4 ? 'width: 100%; max-width: 800px;' : is58 ? 'width: 58mm;' : 'width: 80mm;';
  const fontSize = isA4 ? '13px' : is58 ? '10px' : '11px';

  const itemsRows = transaction.items.map((item, idx) => {
    return `
      <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed #e2e8f0;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>${idx + 1}. ${item.name}</span>
          <span>${formatCurrency(item.subtotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #475569;">
          <span>${item.quantity} x ${formatCurrency(item.price)}</span>
        </div>
        ${item.kaosColor || item.kaosSize ? `
          <div style="font-size: 0.85em; font-weight: 600; color: #00871f;">
            [Varian Kaos: ${item.kaosColor || '-'} | Size: ${item.kaosSize || '-'}]
          </div>
        ` : ''}
        ${item.notes ? `
          <div style="font-size: 0.85em; font-style: italic; color: #64748b;">
            * ${item.notes}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Struk_${transaction.invoiceNo}</title>
  <style>
    @page {
      size: ${isA4 ? 'A4 portrait' : is58 ? '58mm auto' : '80mm auto'};
      margin: ${isA4 ? '15mm' : '3mm'};
    }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: ${fontSize};
      color: #000;
      background: #fff;
      margin: 0;
      padding: ${isA4 ? '20px' : '4px'};
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container {
      ${widthStyle}
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
    }
    .store-name {
      font-size: ${isA4 ? '20px' : '14px'};
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .store-subtitle {
      font-size: 0.85em;
      color: #334155;
      margin-bottom: 2px;
    }
    .store-address {
      font-size: 0.8em;
      color: #475569;
      line-height: 1.3;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .divider-double {
      border-top: 2px solid #000;
      margin: 8px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 0.9em;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 1.1em;
      margin: 4px 0;
    }
    .status-badge {
      display: inline-block;
      text-align: center;
      font-weight: bold;
      padding: 3px 8px;
      border: 1px solid #000;
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      font-size: 0.8em;
      margin-top: 12px;
      line-height: 1.4;
      color: #334155;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="store-name">ATHREE STUDIO JAYAPURA</div>
      <div class="store-subtitle">Custom Jersey &bull; Sablon DTF &bull; Merchandise</div>
      <div class="store-address">
        Jl. Raya Abepura - Jayapura, Papua<br/>
        WhatsApp: 0812-4899-2311
      </div>
    </div>

    <div class="divider"></div>

    <div class="info-row">
      <span>No. Faktur:</span>
      <span style="font-weight: bold;">${transaction.invoiceNo}</span>
    </div>
    <div class="info-row">
      <span>Tanggal:</span>
      <span>${transaction.date}</span>
    </div>
    <div class="info-row">
      <span>Jatuh Tempo:</span>
      <span style="font-weight: bold; color: #b91c1c;">${transaction.dueDate || 'Langsung Selesai'}</span>
    </div>
    <div class="info-row">
      <span>Pelanggan:</span>
      <span style="font-weight: bold;">${transaction.customer.name}</span>
    </div>
    ${transaction.customer.phone ? `
      <div class="info-row">
        <span>No. HP:</span>
        <span>${transaction.customer.phone}</span>
      </div>
    ` : ''}
    <div class="info-row">
      <span>Kasir / Sales:</span>
      <span>${transaction.cashierName || 'DIMAS'} (${transaction.orderType || 'Kasir'})</span>
    </div>

    <div class="divider"></div>
    <div style="font-weight: bold; margin-bottom: 6px;">RINCIAN PESANAN:</div>

    <div class="items-list">
      ${itemsRows}
    </div>

    <div class="divider"></div>

    <div class="info-row">
      <span>Subtotal:</span>
      <span>${formatCurrency(transaction.subtotal)}</span>
    </div>

    ${transaction.discount > 0 ? `
      <div class="info-row">
        <span>Diskon:</span>
        <span style="color: #b91c1c;">-${formatCurrency(transaction.discount)}</span>
      </div>
    ` : ''}

    <div class="divider"></div>

    <div class="total-row">
      <span>TOTAL TAGIHAN:</span>
      <span>${formatCurrency(transaction.total)}</span>
    </div>

    <div class="info-row">
      <span>Metode Bayar:</span>
      <span style="font-weight: 600;">${transaction.paymentMethod}</span>
    </div>

    <div class="info-row">
      <span>Jumlah Dibayar:</span>
      <span style="font-weight: bold;">${formatCurrency(transaction.amountPaid)}</span>
    </div>

    ${transaction.remainingAmount && transaction.remainingAmount > 0 ? `
      <div class="info-row" style="color: #b91c1c; font-weight: bold;">
        <span>SISA PIUTANG:</span>
        <span>${formatCurrency(transaction.remainingAmount)}</span>
      </div>
      <div class="info-row" style="font-size: 0.85em; color: #b91c1c;">
        <span>Status Bayar:</span>
        <span>${transaction.paymentStatus || 'BELUM LUNAS / DP'}</span>
      </div>
    ` : `
      <div class="info-row">
        <span>Kembalian:</span>
        <span style="font-weight: bold;">${formatCurrency(transaction.change)}</span>
      </div>
      <div class="info-row" style="color: #00871f; font-weight: bold;">
        <span>Status Bayar:</span>
        <span>LUNAS</span>
      </div>
    `}

    <div class="divider-double"></div>

    <div style="text-align: center;">
      <span class="status-badge">
        STATUS PRODUKSI: ${transaction.status.toUpperCase()}
      </span>
    </div>

    ${isA4 ? `
      <div style="margin-top: 30px; display: flex; justify-content: space-between; text-align: center;">
        <div style="width: 45%;">
          Hormat Kami,<br/><br/><br/><br/>
          ( <strong>${transaction.cashierName || 'Athree Studio'}</strong> )
        </div>
        <div style="width: 45%;">
          Pelanggan,<br/><br/><br/><br/>
          ( <strong>${transaction.customer.name}</strong> )
        </div>
      </div>
    ` : ''}

    <div class="footer">
      <div>Terima kasih atas kepercayaan Anda di Athree Studio!</div>
      <div style="font-size: 0.9em; margin-top: 3px;">Harap simpan struk ini sebagai bukti sah pengambilan pesanan.</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Print directly to printer via hidden iframe (does NOT download file!)
 * Triggers browser print dialog showing destination printer.
 */
export function printTransactionDirectly(
  transaction: Transaction,
  options: { format?: PrintFormat } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const format = options.format || 'thermal80';
      const htmlContent = generateReceiptHTML(transaction, format);

      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      iframe.contentWindow?.focus();

      // Trigger print after iframe renders
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
          resolve(true);
        } catch (e) {
          console.error('Print trigger error:', e);
          resolve(false);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }
      }, 300);
    } catch (err) {
      console.error('Print transaction directly failed:', err);
      resolve(false);
    }
  });
}
