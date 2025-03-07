import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // Extract query parameters from the request URL
    const url = new URL(req.url);

    return NextResponse.json({ success: true, url }, { status: 200 });
  } catch (error: unknown) {
    // TypeScript-safe error handling
    console.error("API Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Internal Server Error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", details: "An unknown error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    return NextResponse.json({ success: true, body }, { status: 200 });
  } catch (error: unknown) {
    // Use `unknown` instead of `any`
    console.error("API Error:", error);
    // Type guard to handle known error structures
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Internal Server Error", details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error", details: "An unknown error occurred" },
      { status: 500 }
    );
  }
}
