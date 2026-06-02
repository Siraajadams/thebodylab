import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "WhatsApp webhook GET route is working",
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: "WhatsApp webhook POST route is working",
  });
}
