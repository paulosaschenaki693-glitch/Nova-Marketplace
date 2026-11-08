import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ error: 'This workflow is no longer available. Buyers contact sellers directly; Nova sells listing coins.' }, { status: 410 }); }
export async function POST() { return NextResponse.json({ error: 'This workflow is no longer available.' }, { status: 410 }); }
export async function PATCH() { return NextResponse.json({ error: 'This workflow is no longer available.' }, { status: 410 }); }
export async function DELETE() { return NextResponse.json({ error: 'This workflow is no longer available.' }, { status: 410 }); }
