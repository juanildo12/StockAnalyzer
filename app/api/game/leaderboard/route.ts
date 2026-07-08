import { NextRequest, NextResponse } from 'next/server';

interface LeaderboardEntry {
  name: string;
  score: number;
  streak: number;
  date: string;
}

let leaderboard: LeaderboardEntry[] = [];

export async function GET() {
  return NextResponse.json({ leaderboard: leaderboard.slice(0, 20) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, score, streak }: { name: string; score: number; streak: number } = body;

    if (!name || score == null) {
      return NextResponse.json({ error: 'Name and score required' }, { status: 400 });
    }

    const entry: LeaderboardEntry = {
      name: name.slice(0, 20),
      score,
      streak,
      date: new Date().toISOString(),
    };

    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score || b.streak - a.streak);
    if (leaderboard.length > 100) leaderboard = leaderboard.slice(0, 100);

    return NextResponse.json({ success: true, position: leaderboard.indexOf(entry) + 1 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
