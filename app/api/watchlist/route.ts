import { NextRequest, NextResponse } from 'next/server';
import { addWatchlistItem, getWatchlistFromFirestore, removeWatchlistItem, updateWatchlistItem } from '@/src/services/firebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userId = session.user.email;
    const watchlist = await getWatchlistFromFirestore(userId);
    
    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    return NextResponse.json({ error: 'Error al obtener watchlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userId = session.user.email;
    const body = await request.json();
    
    const { symbol, alertEnabled, alertPrice, alertType } = body;
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol es requerido' }, { status: 400 });
    }

    const item = {
      symbol: symbol.toUpperCase(),
      addedAt: new Date().toISOString(),
      alertEnabled: alertEnabled ?? false,
      alertPrice: alertPrice ?? 0,
      alertType: alertType ?? 'above',
    };

    const watchlist = await addWatchlistItem(userId, item);
    
    return NextResponse.json({ 
      success: true, 
      message: `${symbol} agregado a Watchlist`,
      watchlist 
    });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return NextResponse.json({ error: 'Error al agregar a watchlist' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userId = session.user.email;
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol es requerido' }, { status: 400 });
    }

    const watchlist = await removeWatchlistItem(userId, symbol.toUpperCase());
    
    return NextResponse.json({ 
      success: true, 
      message: `${symbol} eliminado de Watchlist`,
      watchlist 
    });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return NextResponse.json({ error: 'Error al eliminar de watchlist' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const userId = session.user.email;
    const body = await request.json();
    
    const { symbol, alertEnabled, alertPrice, alertType } = body;
    
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol es requerido' }, { status: 400 });
    }

    const updates: any = {};
    if (alertEnabled !== undefined) updates.alertEnabled = alertEnabled;
    if (alertPrice !== undefined) updates.alertPrice = alertPrice;
    if (alertType !== undefined) updates.alertType = alertType;

    const watchlist = await updateWatchlistItem(userId, symbol.toUpperCase(), updates);
    
    return NextResponse.json({ 
      success: true, 
      message: `${symbol} actualizado`,
      watchlist 
    });
  } catch (error) {
    console.error('Error updating watchlist:', error);
    return NextResponse.json({ error: 'Error al actualizar watchlist' }, { status: 500 });
  }
}
