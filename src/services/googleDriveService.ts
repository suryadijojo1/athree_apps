import { getAccessToken } from './googleAuth';
import { DriveFile } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const BACKUP_FOLDER_NAME = 'POS_DEAZBAR_Backups';

/**
 * List files from Google Drive
 */
export async function listDriveFiles(options: {
  folderId?: string;
  query?: string;
  pageSize?: number;
  mimeTypeFilter?: string;
} = {}): Promise<DriveFile[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sesi Google Drive belum terhubung. Silakan login dengan akun Google terlebih dahulu.');
  }

  const { folderId, query, pageSize = 50, mimeTypeFilter } = options;
  const conditions: string[] = ['trashed = false'];

  if (folderId) {
    conditions.push(`'${folderId}' in parents`);
  }

  if (mimeTypeFilter) {
    if (mimeTypeFilter === 'folder') {
      conditions.push(`mimeType = 'application/vnd.google-apps.folder'`);
    } else if (mimeTypeFilter === 'json') {
      conditions.push(`mimeType = 'application/json'`);
    } else if (mimeTypeFilter === 'spreadsheet') {
      conditions.push(`(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'text/csv')`);
    } else if (mimeTypeFilter === 'pdf') {
      conditions.push(`mimeType = 'application/pdf'`);
    }
  }

  if (query && query.trim()) {
    const sanitized = query.replace(/'/g, "\\'");
    conditions.push(`name contains '${sanitized}'`);
  }

  const q = conditions.join(' and ');
  const fields = 'files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, iconLink, thumbnailLink, parents)';
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&pageSize=${pageSize}&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal mengambil daftar file dari Google Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Get or create the dedicated app backup folder in Google Drive
 */
export async function getOrCreateBackupFolder(folderName: string = BACKUP_FOLDER_NAME): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sesi Google Drive belum terhubung.');
  }

  // 1. Search if folder already exists
  const searchQ = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(searchQ)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // 2. Create folder if not found
  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder penyimpanan cadangan data dan laporan otomatis Aplikasi Kasir DEAZBAR POS'
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Gagal membuat folder di Google Drive');
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

/**
 * Upload a file (JSON, PDF, CSV, Excel, Image, etc.) to Google Drive using multipart upload
 */
export async function uploadFileToDrive(options: {
  name: string;
  mimeType: string;
  content: Blob | string;
  folderId?: string;
  description?: string;
}): Promise<DriveFile> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sesi Google Drive belum terhubung.');
  }

  const { name, mimeType, content, folderId, description } = options;

  const metadata: Record<string, any> = {
    name,
    mimeType,
    description: description || `Diunggah dari Aplikasi Kasir DEAZBAR pada ${new Date().toLocaleString('id-ID')}`
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let contentBlob: Blob;
  if (typeof content === 'string') {
    contentBlob = new Blob([content], { type: mimeType });
  } else {
    contentBlob = content;
  }

  const metadataBlob = new Blob(
    [`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}${delimiter}Content-Type: ${mimeType}\r\n\r\n`],
    { type: 'text/plain' }
  );
  const footerBlob = new Blob([closeDelimiter], { type: 'text/plain' });

  const multipartBody = new Blob([metadataBlob, contentBlob, footerBlob], {
    type: `multipart/related; boundary=${boundary}`
  });

  const uploadUrl = `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,createdTime,webViewLink,iconLink,thumbnailLink`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: multipartBody
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal mengunggah file ke Google Drive (${response.status})`);
  }

  return await response.json();
}

/**
 * Delete a file from Google Drive (Requires explicit confirmation beforehand!)
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sesi Google Drive belum terhubung.');
  }

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 204) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal menghapus file dari Google Drive (${response.status})`);
  }
}

/**
 * Download raw text / JSON content of a file from Google Drive
 */
export async function downloadFileContent(fileId: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sesi Google Drive belum terhubung.');
  }

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Gagal mengunduh konten file dari Google Drive (${response.status})`);
  }

  return await response.text();
}

/**
 * Backup entire app state into Google Drive as a structured JSON file inside POS_DEAZBAR_Backups folder
 */
export async function backupAppDataToDrive(payload: {
  transactions: any[];
  products: any[];
  cashFlowRecords: any[];
  shifts?: any[];
  stockMovements?: any[];
  customers?: any[];
  currentStartingCash?: number;
  kaosStocks?: any[];
}): Promise<DriveFile> {
  const folderId = await getOrCreateBackupFolder(BACKUP_FOLDER_NAME);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `Backup_DEAZBAR_POS_${timestamp}.json`;

  const backupData = {
    version: '2.0',
    appName: 'DEAZBAR POS & Retail System',
    backupCreatedAt: new Date().toISOString(),
    backupCreatedAtFormatted: new Date().toLocaleString('id-ID'),
    totalTransactions: payload.transactions.length,
    totalProducts: payload.products.length,
    totalCashFlowRecords: payload.cashFlowRecords.length,
    data: payload
  };

  const jsonContent = JSON.stringify(backupData, null, 2);

  return await uploadFileToDrive({
    name: fileName,
    mimeType: 'application/json',
    content: jsonContent,
    folderId,
    description: `Cadangan Data Lengkap Sistem Kasir (${payload.transactions.length} Transaksi, ${payload.products.length} Produk)`
  });
}
