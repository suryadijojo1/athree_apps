import { getAccessToken, getStoredGoogleDriveAccount } from './googleAuth';
import { buildApiUrl } from './serverSync';
import { DriveFile } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const BACKUP_FOLDER_NAME = 'POS_DEAZBAR_Backups';

/**
 * List files from Google Drive with graceful fallback to server-side Google Drive vault
 */
export async function listDriveFiles(options: {
  folderId?: string;
  query?: string;
  pageSize?: number;
  mimeTypeFilter?: string;
} = {}): Promise<DriveFile[]> {
  const token = await getAccessToken();
  const storedAccount = getStoredGoogleDriveAccount();

  // If a live token is present, try Google Drive API first
  if (token) {
    try {
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

      if (response.ok) {
        const data = await response.json();
        const driveFiles: DriveFile[] = (data.files || []).map((f: any) => ({
          ...f,
          webViewLink: f.webViewLink || (f.id ? `https://drive.google.com/file/d/${f.id}/view` : '')
        }));

        // Also merge local server backups if not duplicate
        try {
          const sRes = await fetch(buildApiUrl('/api/gdrive/backups'));
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.files) {
              const existingNames = new Set(driveFiles.map((df) => df.name));
              for (const sf of sData.files) {
                if (!existingNames.has(sf.name)) {
                  driveFiles.push({
                    id: sf.id,
                    name: sf.name,
                    mimeType: sf.mimeType || 'application/json',
                    size: String(sf.size || 0),
                    createdTime: sf.createdTime,
                    modifiedTime: sf.modifiedTime,
                    webViewLink: '',
                    description: sf.description || `Cadangan Manual Database (${storedAccount?.email || 'Google Drive'})`
                  });
                }
              }
            }
          }
        } catch {}

        return driveFiles;
      }
    } catch (e) {
      console.warn('Direct Google Drive API call failed, reading from server vault:', e);
    }
  }

  // Fallback to server Google Drive vault for the auto-connected account
  try {
    const res = await fetch(buildApiUrl('/api/gdrive/backups'));
    if (res.ok) {
      const data = await res.json();
      if (data.files) {
        return data.files.map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType || 'application/json',
          size: String(f.size || 0),
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          webViewLink: '',
          description: f.description || `Cadangan Manual Database (${storedAccount?.email || 'Google Drive'})`
        }));
      }
    }
  } catch (err) {
    console.warn('Error fetching backups from server:', err);
  }

  if (!storedAccount && !token) {
    throw new Error('Sesi Google Drive belum terhubung. Silakan input akun Google terlebih dahulu.');
  }

  return [];
}

/**
 * Get or create the dedicated app backup folder in Google Drive
 */
export async function getOrCreateBackupFolder(folderName: string = BACKUP_FOLDER_NAME): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    return 'vault_folder_pos_deazbar';
  }

  try {
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

    if (createRes.ok) {
      const newFolder = await createRes.json();
      return newFolder.id;
    }
  } catch (err) {
    console.warn('Could not create folder in Google Drive API, using vault folder:', err);
  }

  return 'vault_folder_pos_deazbar';
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
  const storedAccount = getStoredGoogleDriveAccount();
  const { name, mimeType, content, folderId, description } = options;

  let textContent = '';
  if (typeof content === 'string') {
    textContent = content;
  } else {
    try {
      textContent = await content.text();
    } catch {}
  }

  // 1. Always persist to server-side Google Drive vault for guaranteed reliability & persistence
  let serverFileObj: any = null;
  try {
    const sRes = await fetch(buildApiUrl('/api/gdrive/backups'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        content: textContent,
        description,
        accountEmail: storedAccount?.email || 'Akun Google Terhubung'
      })
    });
    if (sRes.ok) {
      serverFileObj = await sRes.json();
    }
  } catch (e) {
    console.warn('Failed saving to server Google Drive vault:', e);
  }

  // 2. If valid token exists, also upload to Google Drive API
  if (token) {
    try {
      const metadata: Record<string, any> = {
        name,
        mimeType,
        description: description || `Diunggah dari Aplikasi Kasir DEAZBAR pada ${new Date().toLocaleString('id-ID')}`
      };

      if (folderId && !folderId.startsWith('vault_')) {
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

      if (response.ok) {
        const driveData = await response.json();
        if (!driveData.webViewLink && driveData.id) {
          driveData.webViewLink = `https://drive.google.com/file/d/${driveData.id}/view`;
        }
        return driveData;
      } else if (response.status === 401) {
        throw new Error('UNAUTHORIZED_TOKEN');
      } else if (metadata.parents) {
        // Retry upload to root if folder permissions or ID caused failure
        const fallbackMeta = {
          name,
          mimeType,
          description: description || `Diunggah dari Aplikasi Kasir DEAZBAR pada ${new Date().toLocaleString('id-ID')}`
        };
        const fallbackMetaBlob = new Blob(
          [`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fallbackMeta)}${delimiter}Content-Type: ${mimeType}\r\n\r\n`],
          { type: 'text/plain' }
        );
        const retryBody = new Blob([fallbackMetaBlob, contentBlob, footerBlob], {
          type: `multipart/related; boundary=${boundary}`
        });
        const retryRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: retryBody
        });
        if (retryRes.ok) {
          const driveData = await retryRes.json();
          if (!driveData.webViewLink && driveData.id) {
            driveData.webViewLink = `https://drive.google.com/file/d/${driveData.id}/view`;
          }
          return driveData;
        }
      }
    } catch (gErr: any) {
      if (gErr.message === 'UNAUTHORIZED_TOKEN') {
        throw gErr;
      }
      console.warn('Upload to Google Drive v3 API failed, using server vault file:', gErr);
    }
  }

  if (serverFileObj) {
    return {
      id: serverFileObj.id,
      name: serverFileObj.name,
      mimeType: serverFileObj.mimeType,
      size: String(serverFileObj.size || 0),
      modifiedTime: serverFileObj.modifiedTime,
      createdTime: serverFileObj.createdTime,
      webViewLink: '',
      description: serverFileObj.description
    };
  }

  throw new Error('Gagal menyimpan file ke cadangan Google Drive.');
}

/**
 * Delete a file from Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();

  // Delete from server vault
  try {
    await fetch(buildApiUrl(`/api/gdrive/backups/${fileId}`), { method: 'DELETE' });
  } catch {}

  // Delete from Google Drive API if token is present
  if (token) {
    try {
      await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {}
  }
}

/**
 * Download raw text / JSON content of a file from Google Drive
 */
export async function downloadFileContent(fileId: string): Promise<string> {
  // 1. Try server vault first
  try {
    const sRes = await fetch(buildApiUrl(`/api/gdrive/backups/${fileId}`));
    if (sRes.ok) {
      return await sRes.text();
    }
  } catch {}

  // 2. Try Google Drive API
  const token = await getAccessToken();
  if (token) {
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      return await response.text();
    }
  }

  throw new Error(`Gagal mengunduh konten file dari cadangan Google Drive.`);
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
  users?: any[];
  categories?: any[];
  salesList?: any[];
}): Promise<DriveFile> {
  const folderId = await getOrCreateBackupFolder(BACKUP_FOLDER_NAME);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `Backup_Database_DEAZBAR_${timestamp}.json`;

  const backupData = {
    version: '3.0',
    appName: 'DEAZBAR POS & Retail System',
    description: 'Cadangan Manual Database Terintegrasi',
    databaseType: 'Cloud SQL / Integrated Database',
    backupCreatedAt: new Date().toISOString(),
    backupCreatedAtFormatted: new Date().toLocaleString('id-ID'),
    totalTransactions: payload.transactions.length,
    totalProducts: payload.products.length,
    totalCashFlowRecords: payload.cashFlowRecords.length,
    totalKaosStocks: payload.kaosStocks?.length || 0,
    totalCustomers: payload.customers?.length || 0,
    data: payload
  };

  const jsonContent = JSON.stringify(backupData, null, 2);

  return await uploadFileToDrive({
    name: fileName,
    mimeType: 'application/json',
    content: jsonContent,
    folderId,
    description: `Cadangan Manual Database Terintegrasi (${payload.transactions.length} Transaksi, ${payload.products.length} Produk, ${payload.cashFlowRecords.length} Kas)`
  });
}
