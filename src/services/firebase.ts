import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User } from "firebase/auth";

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

function getApp(): FirebaseApp {
  if (!_app) {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    };
    _app = initializeApp(firebaseConfig);
  }
  return _app;
}

function getDb(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  if (!_db) {
    _db = getFirestore(getApp());
  }
  return _db;
}

function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function getAuthSafe() {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return null;
  try {
    return getAuth(getApp());
  } catch {
    return null;
  }
}

const auth = getAuthSafe();
const googleProvider = isFirebaseConfigured() ? new GoogleAuthProvider() : null;

export { auth, googleProvider, isFirebaseConfigured };

async function withDb<T>(fn: (db: Firestore) => Promise<T>): Promise<T | null> {
  const db = getDb();
  if (!db) return null;
  try {
    return await fn(db);
  } catch (e) {
    console.warn('[Firebase] operation failed:', e);
    return null;
  }
}

export async function saveUserEmail(userId: string, email: string): Promise<void> {
  await withDb(db => setDoc(doc(db, "users", userId), { email, updatedAt: new Date().toISOString() }));
}

export async function getUserEmail(userId: string): Promise<string | null> {
  return withDb(async db => {
    const docSnap = await getDoc(doc(db, "users", userId));
    return docSnap.exists() ? (docSnap.data().email || null) : null;
  });
}

export async function getAllWatchlistUsers(): Promise<{ userId: string; email: string }[]> {
  const result = await withDb(async db => {
    const snapshot = await getDocs(collection(db, "users"));
    const users: { userId: string; email: string }[] = [];
    snapshot.forEach(d => {
      const data = d.data();
      if (data.email) users.push({ userId: d.id, email: data.email });
    });
    return users;
  });
  return result ?? [];
}

export async function getAlertedSymbols(userId: string): Promise<string[]> {
  const result = await withDb(async db => {
    const docSnap = await getDoc(doc(db, "alerted", userId));
    return docSnap.exists() ? (docSnap.data().symbols || []) : [];
  });
  return result ?? [];
}

export async function addAlertedSymbol(userId: string, symbol: string): Promise<void> {
  const alerted = await getAlertedSymbols(userId);
  if (!alerted.includes(symbol)) {
    alerted.push(symbol);
    await withDb(db => setDoc(doc(db, "alerted", userId), { symbols: alerted, updatedAt: new Date().toISOString() }));
  }
}

export async function clearAlertedSymbol(userId: string, symbol: string): Promise<void> {
  const alerted = await getAlertedSymbols(userId);
  await withDb(db => setDoc(doc(db, "alerted", userId), { symbols: alerted.filter(s => s !== symbol), updatedAt: new Date().toISOString() }));
}

export interface PortfolioItem {
  symbol: string;
  purchasePrice: number;
  shares: number;
  purchaseDate: string;
  currentPrice?: number;
  notes?: string;
  targetPrice?: number;
}

export async function savePortfolioToFirestore(userId: string, portfolio: PortfolioItem[]): Promise<void> {
  await withDb(db => setDoc(doc(db, "portfolios", userId), { portfolio, updatedAt: new Date().toISOString() }));
}

export async function getPortfolioFromFirestore(userId: string): Promise<PortfolioItem[]> {
  const result = await withDb(async db => {
    const docSnap = await getDoc(doc(db, "portfolios", userId));
    return docSnap.exists() ? (docSnap.data().portfolio || []) : [];
  });
  return result ?? [];
}

export async function addPortfolioItem(userId: string, item: PortfolioItem): Promise<PortfolioItem[]> {
  const portfolio = await getPortfolioFromFirestore(userId);
  const existingIndex = portfolio.findIndex(p => p.symbol === item.symbol);
  
  if (existingIndex >= 0) {
    const existing = portfolio[existingIndex];
    const totalShares = existing.shares + item.shares;
    portfolio[existingIndex] = {
      ...existing,
      shares: totalShares,
      purchasePrice: (existing.purchasePrice * existing.shares + item.purchasePrice * item.shares) / totalShares,
      purchaseDate: item.purchaseDate,
      notes: item.notes || existing.notes,
      targetPrice: item.targetPrice || existing.targetPrice,
    };
  } else {
    portfolio.push(item);
  }
  
  await savePortfolioToFirestore(userId, portfolio);
  return portfolio;
}

export async function updatePortfolioItem(userId: string, symbol: string, updates: Partial<PortfolioItem>): Promise<PortfolioItem[]> {
  const portfolio = await getPortfolioFromFirestore(userId);
  const index = portfolio.findIndex(p => p.symbol === symbol);
  if (index >= 0) {
    portfolio[index] = { ...portfolio[index], ...updates };
    await savePortfolioToFirestore(userId, portfolio);
  }
  return portfolio;
}

export async function removePortfolioItem(userId: string, symbol: string): Promise<PortfolioItem[]> {
  const portfolio = await getPortfolioFromFirestore(userId);
  const filtered = portfolio.filter(p => p.symbol !== symbol);
  await savePortfolioToFirestore(userId, filtered);
  return filtered;
}

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
  notes?: string;
  alertPrice?: number;
  alertType?: 'above' | 'below';
  alertEnabled?: boolean;
}

export async function saveWatchlistToFirestore(userId: string, watchlist: WatchlistItem[]): Promise<void> {
  await withDb(db => setDoc(doc(db, "watchlists", userId), { watchlist, updatedAt: new Date().toISOString() }));
}

export async function getWatchlistFromFirestore(userId: string): Promise<WatchlistItem[]> {
  const result = await withDb(async db => {
    const docSnap = await getDoc(doc(db, "watchlists", userId));
    return docSnap.exists() ? (docSnap.data().watchlist || []) : [];
  });
  return result ?? [];
}

export async function addWatchlistItem(userId: string, item: WatchlistItem): Promise<WatchlistItem[]> {
  const watchlist = await getWatchlistFromFirestore(userId);
  if (!watchlist.some(w => w.symbol === item.symbol)) {
    watchlist.push(item);
    await saveWatchlistToFirestore(userId, watchlist);
  }
  return watchlist;
}

export async function updateWatchlistItem(userId: string, symbol: string, updates: Partial<WatchlistItem>): Promise<WatchlistItem[]> {
  const watchlist = await getWatchlistFromFirestore(userId);
  const index = watchlist.findIndex(w => w.symbol === symbol);
  if (index >= 0) {
    watchlist[index] = { ...watchlist[index], ...updates };
    if (updates.alertPrice !== undefined || updates.alertType !== undefined || updates.alertEnabled !== undefined) {
      await clearAlertedSymbol(userId, symbol);
    }
    await saveWatchlistToFirestore(userId, watchlist);
  }
  return watchlist;
}

export async function removeWatchlistItem(userId: string, symbol: string): Promise<WatchlistItem[]> {
  const watchlist = await getWatchlistFromFirestore(userId);
  const filtered = watchlist.filter(w => w.symbol !== symbol);
  await saveWatchlistToFirestore(userId, filtered);
  return filtered;
}
