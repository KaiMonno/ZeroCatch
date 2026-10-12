import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Vercel Cron calls this daily (see vercel.json); it starts the GitHub Actions
 * scrape via workflow_dispatch. GitHub's own `schedule` trigger can run hours
 * late under load, while a dispatch starts right away. The workflow's schedule
 * stays as a backup: scrape runs are idempotent, so running twice is harmless.
 */
const WORKFLOW_URL = "https://api.github.com/repos/KaiMonno/ZeroCatch/actions/workflows/scrape.yml/dispatches";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return Response.json({ error: "GITHUB_DISPATCH_TOKEN is not set" }, { status: 500 });

  const response = await fetch(WORKFLOW_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main" }),
    cache: "no-store",
  });

  if (!response.ok) {
    // GitHub's message only (never the token); visible in Vercel's cron logs.
    const detail = await response.text();
    return Response.json({ error: `GitHub returned ${response.status}`, detail: detail.slice(0, 300) }, { status: 502 });
  }
  return Response.json({ dispatched: true, at: new Date().toISOString() });
}
