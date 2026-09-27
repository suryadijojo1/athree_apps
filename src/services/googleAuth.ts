import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add Google Drive scopes
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account'
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory
let cachedAccessToken: string | null = null;
let currentGoogleUser: any = null;

// Persistent storage key to remember the input Google account connection across refreshes
const GDRIVE_STORAGE_KEY = 'athree_gdrive_connected_account';

export interface StoredGoogleDriveAccount {
  email: string;
  displayName: string;
  photoURL?: string;
  accessToken?: string;
  savedAt: number;
  autoConnect: boolean;
}

/**
 * Reads the auto-connected Google Drive account stored by the user
 */
export function getStoredGoogleDriveAccount(): StoredGoogleDriveAccount | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(GDRIVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && (parsed.autoConnect !== false)) {
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * Syncs Google Drive connected account from the backend server
 */
export async function syncWithServerGoogleDriveAccount(): Promise<StoredGoogleDriveAccount | null> {
  try {
    const res = await fetch('/api/gdrive/account');
    if (res.ok) {
      const data = await res.json();
      if (data && data.connected && data.email) {
        const item: StoredGoogleDriveAccount = {
          email: data.email,
          displayName: data.displayName || data.email,
          photoURL: data.photoURL,
          accessToken: data.accessToken || '',
          savedAt: data.updatedAt || Date.now(),
          autoConnect: true
        };
        saveStoredGoogleDriveAccount(item, false);
        return item;
      }
    }
  } catch (e) {
    console.warn('Failed to sync Google Drive account from server:', e);
  }
  return null;
}

/**
 * Saves the Google Drive account so it automatically stays connected
 */
export function saveStoredGoogleDriveAccount(
  data: {
    email: string;
    displayName?: string;
    photoURL?: string;
    accessToken?: string;
    autoConnect?: boolean;
  },
  syncServer: boolean = true
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const item: StoredGoogleDriveAccount = {
      email: data.email || 'Akun Google Drive',
      displayName: data.displayName || data.email || 'Pengguna Google Drive',
      photoURL: data.photoURL,
      accessToken: data.accessToken || '',
      savedAt: Date.now(),
      autoConnect: data.autoConnect !== false
    };
    localStorage.setItem(GDRIVE_STORAGE_KEY, JSON.stringify(item));

    if (syncServer) {
      fetch('/api/gdrive/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      }).catch((e) => console.warn('Could not persist Google Drive account to server:', e));
    }
  } catch {}
}

/**
 * Clears stored account upon explicit logout
 */
export function clearStoredGoogleDriveAccount(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GDRIVE_STORAGE_KEY);
    }
    fetch('/api/gdrive/disconnect', { method: 'POST' }).catch(() => {});
  } catch {}
}

// Helper to check if Google Identity Services (GIS) library is loaded
export const isGsiAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).google?.accounts?.oauth2;
};

export const getOAuthClientId = (): string => {
  return firebaseConfig.oAuthClientId || '';
};

/**
 * Connect to an input Google account (email and optional access token).
 * Persists permanently across refreshes, session timeouts, and reloads.
 */
export const connectInputGoogleAccount = async (
  email: string,
  displayName?: string,
  token?: string
): Promise<{ user: any; accessToken: string }> => {
  if (!email || !email.trim()) {
    throw new Error('Email akun Google wajib diisi');
  }
  const cleanEmail = email.trim();
  const cleanToken = token ? token.trim() : '';
  cachedAccessToken = cleanToken || null;

  let userName = displayName || cleanEmail.split('@')[0];
  let photo = '';

  if (cleanToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      if (res.ok) {
        const uData = await res.json();
        if (uData.name) userName = uData.name;
        if (uData.picture) photo = uData.picture;
      }
    } catch {}
  }

  currentGoogleUser = {
    displayName: userName,
    email: cleanEmail,
    photoURL: photo || undefined,
    uid: 'google-drive-' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')
  };

  saveStoredGoogleDriveAccount({
    email: cleanEmail,
    displayName: userName,
    photoURL: photo || undefined,
    accessToken: cleanToken,
    autoConnect: true
  }, true);

  return { user: currentGoogleUser, accessToken: cleanToken };
};

/**
 * Connect manual Google access token and persist for auto-connection
 */
export const setManualAccessToken = async (
  token: string,
  email?: string
): Promise<{ user: any; accessToken: string }> => {
  if (!token.trim()) {
    throw new Error('Access token tidak boleh kosong');
  }
  const cleanToken = token.trim();
  cachedAccessToken = cleanToken;

  // Try to fetch profile from Google userinfo API
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${cleanToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentGoogleUser = {
        displayName: data.name || data.email,
        email: data.email,
        photoURL: data.picture,
        uid: data.sub
      };
    } else {
      currentGoogleUser = {
        displayName: email || 'Akun Google Terkoneksi Otomatis',
        email: email || 'google-drive@user',
        uid: 'manual-token-user'
      };
    }
  } catch {
    currentGoogleUser = {
      displayName: email || 'Akun Google Terkoneksi Otomatis',
      email: email || 'google-drive@user',
      uid: 'manual-token-user'
    };
  }

  // Persist account so Google Drive stays automatically connected!
  saveStoredGoogleDriveAccount({
    email: currentGoogleUser.email,
    displayName: currentGoogleUser.displayName,
    photoURL: currentGoogleUser.photoURL,
    accessToken: cleanToken,
    autoConnect: true
  }, true);

  return { user: currentGoogleUser, accessToken: cachedAccessToken };
};

// Sign in with Google Identity Services (GSI) Token Client
const signInWithGsi = (): Promise<{ user: any; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services SDK belum termuat di peramban.'));
      return;
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      reject(new Error('OAuth Client ID belum dikonfigurasi.'));
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        prompt: 'select_account',
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error || 'Otorisasi Google dibatalkan.'));
            return;
          }
          if (!response.access_token) {
            reject(new Error('Tidak menerima Access Token dari Google.'));
            return;
          }

          cachedAccessToken = response.access_token;

          // Fetch Google user profile
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${cachedAccessToken}` }
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              currentGoogleUser = {
                displayName: uData.name || uData.email,
                email: uData.email,
                photoURL: uData.picture,
                uid: uData.sub
              };
            } else {
              currentGoogleUser = {
                displayName: 'Pengguna Google Drive',
                email: 'google-workspace-user',
                uid: 'gsi-user'
              };
            }
          } catch {
            currentGoogleUser = {
              displayName: 'Pengguna Google Drive',
              email: 'google-workspace-user',
              uid: 'gsi-user'
            };
          }

          // Persist account so Google Drive stays automatically connected!
          saveStoredGoogleDriveAccount({
            email: currentGoogleUser.email,
            displayName: currentGoogleUser.displayName,
            photoURL: currentGoogleUser.photoURL,
            accessToken: cachedAccessToken!
          });

          resolve({ user: currentGoogleUser, accessToken: cachedAccessToken! });
        },
        error_callback: (err: any) => {
          reject(err || new Error('Gagal membuka dialog otorisasi Google.'));
        }
      });

      client.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Initializes Google Auth with automatic reconnection to previously entered Google account
 */
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  // 1. Immediately check for saved Google account that was input
  const stored = getStoredGoogleDriveAccount();
  if (stored && stored.email) {
    cachedAccessToken = stored.accessToken || null;
    currentGoogleUser = {
      displayName: stored.displayName || stored.email,
      email: stored.email,
      photoURL: stored.photoURL,
      uid: 'stored-google-user'
    };
    if (onAuthSuccess) {
      onAuthSuccess(currentGoogleUser, cachedAccessToken || '');
    }
  }

  // 2. Also query backend server to guarantee auto-reconnect persists across devices & refreshed sessions
  syncWithServerGoogleDriveAccount().then((serverAcc) => {
    if (serverAcc && serverAcc.email) {
      cachedAccessToken = serverAcc.accessToken || null;
      currentGoogleUser = {
        displayName: serverAcc.displayName || serverAcc.email,
        email: serverAcc.email,
        photoURL: serverAcc.photoURL,
        uid: 'stored-google-user'
      };
      if (onAuthSuccess) {
        onAuthSuccess(currentGoogleUser, cachedAccessToken || '');
      }
    }
  }).catch(() => {});

  // 3. Listen for Firebase Auth state changes
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      currentGoogleUser = user;
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken || '');
    } else {
      // User not signed into Firebase Auth directly, but check if we have a stored auto-connected account
      const storedAccount = getStoredGoogleDriveAccount();
      if (storedAccount && storedAccount.email) {
        cachedAccessToken = storedAccount.accessToken || null;
        currentGoogleUser = {
          displayName: storedAccount.displayName || storedAccount.email,
          email: storedAccount.email,
          photoURL: storedAccount.photoURL,
          uid: 'stored-google-user'
        };
        if (onAuthSuccess) onAuthSuccess(currentGoogleUser, cachedAccessToken || '');
      } else if (!cachedAccessToken) {
        currentGoogleUser = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  isSigningIn = true;

  // Try 1: Google Identity Services (GIS) first (Bypasses Firebase auth/unauthorized-domain completely)
  if (isGsiAvailable() && firebaseConfig.oAuthClientId) {
    try {
      const gsiResult = await signInWithGsi();
      isSigningIn = false;
      return gsiResult;
    } catch (gsiErr: any) {
      console.warn('GIS sign-in attempted, checking fallback:', gsiErr);
      if (gsiErr?.message?.includes('cancel') || gsiErr?.message?.includes('user_cancel') || gsiErr?.error === 'access_denied') {
        isSigningIn = false;
        throw gsiErr;
      }
    }
  }

  // Try 2: Firebase signInWithPopup
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token dari otorisasi Google');
    }

    cachedAccessToken = credential.accessToken;
    currentGoogleUser = result.user;

    // Persist account so Google Drive stays automatically connected!
    saveStoredGoogleDriveAccount({
      email: result.user.email || '',
      displayName: result.user.displayName || result.user.email || '',
      photoURL: result.user.photoURL || undefined,
      accessToken: cachedAccessToken,
      autoConnect: true
    }, true);

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    if (error?.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'domain ini';
      const customErr: any = new Error(
        `Domain "${currentHost}" belum diizinkan di Firebase Authentication (auth/unauthorized-domain). Silakan tambahkan domain ini ke daftar Authorized Domains pada Firebase Console project: ${firebaseConfig.projectId}.`
      );
      customErr.code = 'auth/unauthorized-domain';
      customErr.hostname = currentHost;
      customErr.projectId = firebaseConfig.projectId;
      throw customErr;
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Returns active access token with automatic fallback to persistent auto-connect account
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const stored = getStoredGoogleDriveAccount();
  if (stored && stored.email) {
    cachedAccessToken = stored.accessToken || null;
    currentGoogleUser = {
      displayName: stored.displayName || stored.email,
      email: stored.email,
      photoURL: stored.photoURL,
      uid: 'stored-google-user'
    };
    return cachedAccessToken;
  }

  return null;
};

export const getCurrentGoogleUser = (): any => {
  if (currentGoogleUser) return currentGoogleUser;
  const stored = getStoredGoogleDriveAccount();
  if (stored && stored.email) {
    return {
      displayName: stored.displayName || stored.email,
      email: stored.email,
      photoURL: stored.photoURL,
      uid: 'stored-google-user'
    };
  }
  return auth.currentUser;
};

export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  } finally {
    cachedAccessToken = null;
    currentGoogleUser = null;
    clearStoredGoogleDriveAccount();
  }
};
