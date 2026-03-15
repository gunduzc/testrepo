import { NextResponse } from 'next/server';
import { getInstanceConfig } from '@/lib/instance-config';

export async function GET() {
  return NextResponse.json({
    ...getInstanceConfig(),
    llmAvailable: !!process.env.OPENAI_API_KEY,
  });
}
