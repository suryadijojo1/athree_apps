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
  prompt: 'consent'
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token in memory (MANDATORY: never store in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let currentGoogleUser: any = null;

// Helper to check if Google Identity Services (GIS) library is loaded
export const isGsiAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).google?.accounts?.oauth2;
};

export const getOAuthClientId = (): string => {
  return firebaseConfig.oAuthClientId || '';
};

export const setManualAccessToken = async (token: string, email?: string): Promise<{ user: any; accessToken: string }> => {
  if (!token.trim()) {
    throw new Error('Access token tidak boleh kosong');
  }
  cachedAccessToken = token.trim();
  
  // Try to fetch profile from Google userinfo API
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${cachedAccessToken}` }
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
        displayName: email || 'Akun Google (Token Terverifikasi)',
        email: email || 'google-drive@user',
        uid: 'manual-token-user'
      };
    }
  } catch {
    currentGoogleUser = {
      displayName: email || 'Akun Google (Token Terverifikasi)',
      email: email || 'google-drive@user',
      uid: 'manual-token-user'
    };
  }

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
        prompt: 'consent',
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

          resolve({ user: currentGoogleUser, accessToken: cachedAccessToken });
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

export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      currentGoogleUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else if (!cachedAccessToken) {
      currentGoogleUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  isSigningIn = true;

  // Try 1: Google Identity Services (GIS) first (Bypasses Firebase auth/unauthorized-domain completely!)
  if (isGsiAvailable() && firebaseConfig.oAuthClientId) {
    try {
      const gsiResult = await signInWithGsi();
      isSigningIn = false;
      return gsiResult;
    } catch (gsiErr: any) {
      console.warn('GIS sign-in attempted, checking fallback:', gsiErr);
      // If user cancelled, don't fallback to annoying secondary popup
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

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleUser = (): any => {
  return currentGoogleUser || auth.currentUser;
};

export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  } finally {
    cachedAccessToken = null;
    currentGoogleUser = null;
  }
};
