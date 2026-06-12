import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    git_sha:
      process.env.NEXT_PUBLIC_BUILD_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      null,
  });
}
