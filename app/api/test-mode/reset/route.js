import { NextResponse } from 'next/server';
import { resetSimulation } from '@/lib/simulationEngine';

export async function POST(request) {
  try {
    await resetSimulation();
    
    return NextResponse.json({
      success: true,
      message: 'Simulation reset successfully',
    });
  } catch (error) {
    console.error('Reset Simulation Error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

