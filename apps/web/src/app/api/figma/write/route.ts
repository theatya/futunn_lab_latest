import { NextResponse } from "next/server";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BoardPlan, FigmaWriteOptions, FigmaWriteResult } from "@futu/ports";

type WriteJob = {
  id: string;
  sessionId: string;
  boards: BoardPlan[];
  options: FigmaWriteOptions;
  status: "queued" | "claimed" | "completed" | "failed";
  result?: FigmaWriteResult;
  error?: string;
  createdAt: number;
};

const JOB_DIR = join(tmpdir(), "futu-figma-write-jobs");
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...init?.headers },
  });
}

async function ensureJobDir() {
  await mkdir(JOB_DIR, { recursive: true });
}

function jobPath(id: string) {
  return join(JOB_DIR, `${id.replace(/[^a-zA-Z0-9-]/g, "")}.json`);
}

async function loadJob(id: string): Promise<WriteJob | null> {
  try {
    return JSON.parse(await readFile(jobPath(id), "utf8")) as WriteJob;
  } catch {
    return null;
  }
}

async function saveJob(job: WriteJob) {
  await ensureJobDir();
  await writeFile(jobPath(job.id), JSON.stringify(job), "utf8");
}

async function allJobs(): Promise<WriteJob[]> {
  await ensureJobDir();
  const files = await readdir(JOB_DIR);
  const jobs = await Promise.all(files.filter((file) => file.endsWith(".json")).map((file) => loadJob(file.slice(0, -5))));
  return jobs.filter((job): job is WriteJob => Boolean(job));
}

async function removeExpiredJobs() {
  const oldestAllowed = Date.now() - 15 * 60_000;
  for (const job of await allJobs()) {
    if (job.createdAt < oldestAllowed) await rm(jobPath(job.id), { force: true });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  await removeExpiredJobs();
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (jobId) {
    const job = await loadJob(jobId);
    if (!job) return json({ error: "写入任务不存在或已过期" }, { status: 404 });
    return json({ status: job.status, result: job.result, error: job.error });
  }

  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return json({ error: "缺少配对码" }, { status: 400 });
  const job = (await allJobs()).find((item) => item.sessionId === sessionId && item.status === "queued");
  if (!job) return json({ status: "idle" });
  job.status = "claimed";
  await saveJob(job);
  return json({
    status: "job",
    job: { id: job.id, boards: job.boards, options: job.options },
  });
}

export async function POST(request: Request) {
  await removeExpiredJobs();
  const body = (await request.json()) as {
    action?: "create" | "complete" | "fail";
    sessionId?: string;
    jobId?: string;
    boards?: BoardPlan[];
    options?: FigmaWriteOptions;
    result?: FigmaWriteResult;
    error?: string;
  };

  if (body.action === "create") {
    const needsVisual = body.boards?.some((board) => !board.native);
    if (!body.sessionId || !body.boards?.length || !body.options || (needsVisual && !body.options.visualComponent?.id)) {
      return json({ error: "写入任务缺少配对码、画板或主视觉组件" }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await saveJob({
      id,
      sessionId: body.sessionId,
      boards: body.boards,
      options: body.options,
      status: "queued",
      createdAt: Date.now(),
    });
    return json({ jobId: id });
  }

  if (!body.jobId) return json({ error: "缺少写入任务 ID" }, { status: 400 });
  const job = await loadJob(body.jobId);
  if (!job) return json({ error: "写入任务不存在或已过期" }, { status: 404 });
  if (body.action === "complete" && body.result) {
    job.status = "completed";
    job.result = body.result;
    await saveJob(job);
    return json({ ok: true });
  }
  if (body.action === "fail") {
    job.status = "failed";
    job.error = body.error ?? "Figma 插件写入失败";
    await saveJob(job);
    return json({ ok: true });
  }
  return json({ error: "无效的写入任务操作" }, { status: 400 });
}
