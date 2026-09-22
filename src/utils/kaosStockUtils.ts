import { KaosStockItem, OrderItem, StockMovement } from '../types';
import { STANDARD_KAOS_COLORS, STANDARD_KAOS_SIZES, generateKaosStockId } from '../data/mockData';

/**
 * Checks if a product or order item represents a Sablon + Kaos combo
 */
export const isSablonKaosProduct = (productName?: string): boolean => {
  if (!productName) return false;
  const p = productName.toLowerCase();
  return (
    p.includes('sablon + kaos') ||
    p.includes('sablon & kaos') ||
    (p.includes('sablon') && p.includes('kaos')) ||
    p.includes('kaos polos')
  );
};

/**
 * Find stock item by color and size (case-insensitive & whitespace-trimmed)
 */
export const findKaosStockItem = (
  stocks: KaosStockItem[],
  color: string,
  size: string
): KaosStockItem | undefined => {
  const normColor = color.trim().toLowerCase();
  const normSize = size.trim().toLowerCase();
  return stocks.find(
    (s) =>
      s.color.trim().toLowerCase() === normColor &&
      s.size.trim().toLowerCase() === normSize
  );
};

/**
 * Get available stock quantity for a specific color & size
 */
export const getKaosStockQty = (
  stocks: KaosStockItem[],
  color: string,
  size: string
): number => {
  const item = findKaosStockItem(stocks, color, size);
  return item ? item.stock : 0;
};

/**
 * Deduct specific kaos stock for a list of items sold / ordered
 */
export const deductKaosStock = (
  currentStocks: KaosStockItem[],
  items: OrderItem[],
  refNo: string,
  operatorName: string,
  reasonPrefix: string = 'Penjualan'
): { updatedStocks: KaosStockItem[]; movements: StockMovement[] } => {
  const movements: StockMovement[] = [];
  const stockMap = new Map<string, KaosStockItem>();

  // Clone current stocks into map
  currentStocks.forEach((s) => {
    stockMap.set(`${s.color.toLowerCase()}-${s.size.toLowerCase()}`, { ...s });
  });

  items.forEach((item) => {
    if (isSablonKaosProduct(item.name) && item.kaosColor && item.kaosSize) {
      const key = `${item.kaosColor.toLowerCase()}-${item.kaosSize.toLowerCase()}`;
      let stockItem = stockMap.get(key);

      if (!stockItem) {
        // If it doesn't exist yet, create an entry with initial 0
        stockItem = {
          id: generateKaosStockId(item.kaosColor, item.kaosSize),
          color: item.kaosColor,
          size: item.kaosSize,
          stock: 0,
          minStock: 5
        };
        stockMap.set(key, stockItem);
      }

      const prev = stockItem.stock;
      const newStock = Math.max(0, prev - item.quantity);
      stockItem.stock = newStock;

      movements.push({
        id: `sm-kaos-${Date.now()}-${item.kaosColor}-${item.kaosSize}-${Math.random().toString(36).slice(2, 6)}`,
        productId: stockItem.id,
        productName: `Kaos Polos [${item.kaosColor} - Size ${item.kaosSize}]`,
        sku: `KAOS-${item.kaosColor.substring(0, 3).toUpperCase()}-${item.kaosSize.toUpperCase()}`,
        type: 'SALE',
        qty: item.quantity,
        prevStock: prev,
        newStock: newStock,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        reason: `${reasonPrefix} ${refNo} (${item.name})`,
        operatorName,
        referenceNo: refNo
      });
    }
  });

  return {
    updatedStocks: Array.from(stockMap.values()),
    movements
  };
};

/**
 * Restore kaos stock when invoice is canceled, deleted, or reduced in revision
 */
export const restoreKaosStock = (
  currentStocks: KaosStockItem[],
  color: string,
  size: string,
  qty: number,
  refNo: string,
  operatorName: string,
  reason: string
): { updatedStocks: KaosStockItem[]; movement?: StockMovement } => {
  const normColor = color.trim();
  const normSize = size.trim();
  const key = `${normColor.toLowerCase()}-${normSize.toLowerCase()}`;

  let movement: StockMovement | undefined;

  const updatedStocks = currentStocks.map((s) => {
    if (
      s.color.toLowerCase() === normColor.toLowerCase() &&
      s.size.toLowerCase() === normSize.toLowerCase()
    ) {
      const prev = s.stock;
      const newStock = prev + qty;
      movement = {
        id: `sm-kaos-rst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: s.id,
        productName: `Kaos Polos [${normColor} - Size ${normSize}]`,
        sku: `KAOS-${normColor.substring(0, 3).toUpperCase()}-${normSize.toUpperCase()}`,
        type: 'IN',
        qty,
        prevStock: prev,
        newStock,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        reason: `${reason} (${refNo})`,
        operatorName,
        referenceNo: refNo
      };
      return { ...s, stock: newStock };
    }
    return s;
  });

  // If not found in current stocks, add it
  if (!movement && qty > 0) {
    const newStockItem: KaosStockItem = {
      id: generateKaosStockId(normColor, normSize),
      color: normColor,
      size: normSize,
      stock: qty,
      minStock: 5
    };
    updatedStocks.push(newStockItem);
    movement = {
      id: `sm-kaos-rst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: newStockItem.id,
      productName: `Kaos Polos [${normColor} - Size ${normSize}]`,
      sku: `KAOS-${normColor.substring(0, 3).toUpperCase()}-${normSize.toUpperCase()}`,
      type: 'IN',
      qty,
      prevStock: 0,
      newStock: qty,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reason: `${reason} (${refNo})`,
      operatorName,
      referenceNo: refNo
    };
  }

  return { updatedStocks, movement };
};

/**
 * Restore multiple kaos items when an invoice is deleted or canceled
 */
export const restoreMultipleKaosStock = (
  currentStocks: KaosStockItem[],
  items: OrderItem[],
  refNo: string,
  operatorName: string,
  reason: string = 'Pembatalan / Hapus Faktur'
): { updatedStocks: KaosStockItem[]; movements: StockMovement[] } => {
  let stocks = [...currentStocks];
  const movements: StockMovement[] = [];

  items.forEach((item) => {
    if (isSablonKaosProduct(item.name) && item.kaosColor && item.kaosSize && item.quantity > 0) {
      const res = restoreKaosStock(
        stocks,
        item.kaosColor,
        item.kaosSize,
        item.quantity,
        refNo,
        operatorName,
        reason
      );
      stocks = res.updatedStocks;
      if (res.movement) {
        movements.push(res.movement);
      }
    }
  });

  return { updatedStocks: stocks, movements };
};

