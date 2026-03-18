import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC36kL4P3IAh6ZeuUT1IfJAcPuQx1eOe2A",
  authDomain: "stock-analyzer-ef81a.firebaseapp.com",
  projectId: "stock-analyzer-ef81a",
  storageBucket: "stock-analyzer-ef81a.firebasestorage.app",
  messagingSenderId: "471103311976",
  appId: "1:471103311976:web:fc6739f1a8057185beebdd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };

export async function saveUserEmail(userId: string, email: string): Promise<void> {
  const userDocRef = doc(db, "users", userId);
  await setDoc(userDocRef, { email, updatedAt: new Date().toISOString() });
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const userDocRef = doc(db, "users", userId);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return docSnap.data().email || null;
  }
  return null;
}

export async function getAllWatchlistUsers(): Promise<{ userId: string; email: string }[]> {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  const users: { userId: string; email: string }[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.email) {
      users.push({ userId: doc.id, email: data.email });
    }
  });
  return users;
}

export async function getAlertedSymbols(userId: string): Promise<string[]> {
  const userDocRef = doc(db, "alerted", userId);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return docSnap.data().symbols || [];
  }
  return [];
}

export async function addAlertedSymbol(userId: string, symbol: string): Promise<void> {
  const alerted = await getAlertedSymbols(userId);
  if (!alerted.includes(symbol)) {
    alerted.push(symbol);
    const userDocRef = doc(db, "alerted", userId);
    await setDoc(userDocRef, { symbols: alerted, updatedAt: new Date().toISOString() });
  }
}

export async function clearAlertedSymbol(userId: string, symbol: string): Promise<void> {
  const alerted = await getAlertedSymbols(userId);
  const filtered = alerted.filter(s => s !== symbol);
  const userDocRef = doc(db, "alerted", userId);
  await setDoc(userDocRef, { symbols: filtered, updatedAt: new Date().toISOString() });
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
  const userDocRef = doc(db, "portfolios", userId);
  await setDoc(userDocRef, { portfolio, updatedAt: new Date().toISOString() });
}

export async function getPortfolioFromFirestore(userId: string): Promise<PortfolioItem[]> {
  const userDocRef = doc(db, "portfolios", userId);
  const docSnap = await getDoc(userDocRef);
  
  if (docSnap.exists()) {
    return docSnap.data().portfolio || [];
  }
  return [];
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
  const userDocRef = doc(db, "watchlists", userId);
  await setDoc(userDocRef, { watchlist, updatedAt: new Date().toISOString() });
}

export async function getWatchlistFromFirestore(userId: string): Promise<WatchlistItem[]> {
  const userDocRef = doc(db, "watchlists", userId);
  const docSnap = await getDoc(userDocRef);
  
  if (docSnap.exists()) {
    return docSnap.data().watchlist || [];
  }
  return [];
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
    const oldItem = watchlist[index];
    watchlist[index] = { ...watchlist[index], ...updates };
    
    // If alert settings changed (price, type, or enabled), clear the alerted flag
    // so user can receive new alerts
    if (
      updates.alertPrice !== undefined ||
      updates.alertType !== undefined ||
      updates.alertEnabled !== undefined
    ) {
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
