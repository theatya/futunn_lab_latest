import { NextResponse } from "next/server";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { BoardPlan, FigmaWriteOptions, FigmaWriteResult } from "@futu/ports";

type WriteJob = {
  id: string;
  sessionId: string;
  boards: BoardPlan[];
  options: FigmaWriteOptions;
  status: "queued" | "claimed" | "completed" | "failed" | "cancelled";
  claimedAt?: number;
  claimToken?: string;
  claimedVersion?: string;
  claimedFileKey?: string;
  progress?: { completed: number; total: number };
  result?: FigmaWriteResult;
  error?: string;
  activityAt: number;
  createdAt: number;
};

type PluginSession = {
  sessionId: string;
  name: "ExtendLink";
  version: string;
  fileKey?: string;
  seenAt: number;
};

const JOB_DIR = join(tmpdir(), "futu-figma-write-jobs");
const PLUGIN_VERSION = "1.0.0";
const SESSION_TTL = 60_000;
const CLAIM_TTL = 90_000;
const jobLocks = new Map<string, Promise<void>>();
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

function sessionPath(sessionId: string) {
  return join(JOB_DIR, `session-${sessionId.replace(/\D/g, "")}.json`);
}

async function loadJob(id: string): Promise<WriteJob | null> {
  try {
    const job = JSON.parse(await readFile(jobPath(id), "utf8")) as WriteJob;
    job.activityAt ??= job.claimedAt ?? job.createdAt;
    if (!job.options?.fileKey || !job.options.targetNodeId) {
      job.status = "failed";
      job.error = "该写入任务来自不兼容的旧版，请回到平台重新发起写入";
      return job;
    }
    job.options.runId ||= `legacy-${job.id}`;
    return job;
  } catch {
    return null;
  }
}

async function saveJob(job: WriteJob) {
  await ensureJobDir();
  const path = jobPath(job.id);
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(job), "utf8");
  await rename(temporaryPath, path);
}

async function loadSession(sessionId: string): Promise<PluginSession | null> {
  try {
    return JSON.parse(await readFile(sessionPath(sessionId), "utf8")) as PluginSession;
  } catch {
    return null;
  }
}

async function saveSession(session: PluginSession) {
  await ensureJobDir();
  const path = sessionPath(session.sessionId);
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(session), "utf8");
  await rename(temporaryPath, path);
}

async function withJobLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = jobLocks.get(id) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  jobLocks.set(id, queued);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (jobLocks.get(id) === queued) jobLocks.delete(id);
  }
}

async function allJobs(): Promise<WriteJob[]> {
  await ensureJobDir();
  const files = await readdir(JOB_DIR);
  const jobs = await Promise.all(files
    .filter((file) => file.endsWith(".json") && !file.startsWith("session-"))
    .map((file) => loadJob(file.slice(0, -5))));
  return jobs.filter((job): job is WriteJob => Boolean(job));
}

async function removeExpiredJobs() {
  const oldestAllowed = Date.now() - 30 * 60_000;
  for (const job of await allJobs()) {
    if ((job.activityAt ?? job.createdAt) < oldestAllowed) await rm(jobPath(job.id), { force: true });
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
    return await withJobLock(jobId, async () => {
      const job = await loadJob(jobId);
      if (!job) return json({ error: "写入任务不存在或已过期" }, { status: 404 });
      if (searchParams.get("client") === "plugin") {
        if (job.status === "cancelled") {
          return json({ status: job.status });
        }
        if (job.status !== "claimed") {
          return json({ error: "写入任务已经结束或已被重新接管", status: job.status }, { status: 409 });
        }
        const claimToken = searchParams.get("claimToken");
        const version = searchParams.get("version") ?? "0.0.0";
        const fileKey = searchParams.get("fileKey") ?? "";
        if (!claimToken || claimToken !== job.claimToken) {
          return json({ error: "写入任务已由其他连接器接管", status: job.status }, { status: 409 });
        }
        if (version !== PLUGIN_VERSION || version !== job.claimedVersion || fileKey !== job.options.fileKey) {
          return json({ error: "连接器版本或目标文件已变化，请重新连接", status: job.status }, { status: 409 });
        }
        job.claimedAt = Date.now();
        job.activityAt = job.claimedAt;
        await saveJob(job);
        await saveSession({ sessionId: job.sessionId, name: "ExtendLink", version, fileKey, seenAt: Date.now() });
      } else if (job.status === "claimed" && Date.now() - (job.claimedAt ?? 0) > CLAIM_TTL) {
        job.status = "failed";
        job.error = "连接器写入中断，请确认插件保持开启后重试";
        job.activityAt = Date.now();
        await saveJob(job);
      }
      return json({
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        activityAt: job.activityAt ?? job.claimedAt ?? job.createdAt,
      });
    });
  }

  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return json({ error: "缺少连接码" }, { status: 400 });
  if (!/^\d{5}$/.test(sessionId)) return json({ error: "连接码应为 5 位数字" }, { status: 400 });
  const isPlugin = searchParams.get("client") === "plugin";
  const pluginVersion = searchParams.get("version") ?? "0.0.0";
  const pluginFileKey = searchParams.get("fileKey") ?? "";
  if (isPlugin) {
    await saveSession({
      sessionId,
      name: "ExtendLink",
      version: pluginVersion,
      ...(pluginFileKey ? { fileKey: pluginFileKey } : {}),
      seenAt: Date.now(),
    });
  }
  const pluginSession = await loadSession(sessionId);
  const connected = Boolean(pluginSession && Date.now() - pluginSession.seenAt <= SESSION_TTL);
  if (searchParams.get("probe") === "1") {
    return json({
      status: connected ? "connected" : "disconnected",
      connected,
      compatible: connected ? pluginSession?.version === PLUGIN_VERSION : null,
      plugin: connected ? pluginSession : null,
      expectedVersion: PLUGIN_VERSION,
    });
  }
  if (!isPlugin) return json({ status: "idle", connected, compatible: pluginSession?.version === PLUGIN_VERSION });
  if (pluginVersion !== PLUGIN_VERSION) {
    return json({ status: "incompatible", connected: true, compatible: false, expectedVersion: PLUGIN_VERSION });
  }
  const now = Date.now();
  const job = (await allJobs())
    .filter((item) => item.sessionId === sessionId && (
      item.status === "queued"
      || (item.status === "claimed" && now - (item.claimedAt ?? 0) > CLAIM_TTL)
    ))
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!job) return json({ status: "idle", connected, compatible: pluginSession?.version === PLUGIN_VERSION });
  if (!pluginFileKey || pluginFileKey !== job.options.fileKey) {
    return json({
      status: "file-mismatch",
      error: "连接器当前打开的 Figma 文件与写入目标不一致",
      connected: true,
      compatible: true,
    }, { status: 409 });
  }
  const claimed = await withJobLock(job.id, async () => {
    const latest = await loadJob(job.id);
    const claimable = latest && (
      latest.status === "queued"
      || (latest.status === "claimed" && Date.now() - (latest.claimedAt ?? 0) > CLAIM_TTL)
    );
    if (!latest || !claimable) return null;
    latest.status = "claimed";
    latest.claimedAt = Date.now();
    latest.activityAt = latest.claimedAt;
    latest.claimToken = crypto.randomUUID();
    latest.claimedVersion = pluginVersion;
    latest.claimedFileKey = pluginFileKey;
    await saveJob(latest);
    return latest;
  });
  if (!claimed) return json({ status: "idle" });
  return json({
    status: "job",
    job: {
      id: claimed.id,
      claimToken: claimed.claimToken,
      boards: claimed.boards,
      options: claimed.options,
    },
  });
}

export async function POST(request: Request) {
  await removeExpiredJobs();
  const body = (await request.json()) as {
    action?: "create" | "progress" | "complete" | "fail" | "cancel";
    sessionId?: string;
    jobId?: string;
    boards?: BoardPlan[];
    options?: FigmaWriteOptions;
    result?: FigmaWriteResult;
    error?: string;
    claimToken?: string;
    completed?: number;
    total?: number;
  };

  if (body.action === "create") {
    const needsVisual = body.boards?.some((board) => !board.native);
    if (!body.sessionId || !/^\d{5}$/.test(body.sessionId) || !body.boards?.length || !body.options?.fileKey || !body.options.targetNodeId || !body.options.runId || (needsVisual && !body.options.visualComponent?.id)) {
      return json({ error: "写入任务缺少连接码、目标文件、画板或主视觉组件" }, { status: 400 });
    }
    const pluginSession = await loadSession(body.sessionId);
    if (!pluginSession || Date.now() - pluginSession.seenAt > SESSION_TTL) {
      return json({ error: "延展连接器尚未连接，请先在插件中输入连接码" }, { status: 409 });
    }
    if (pluginSession.version !== PLUGIN_VERSION) {
      return json({ error: "连接器版本不匹配，请重新安装最新版" }, { status: 409 });
    }
    if (!pluginSession.fileKey || pluginSession.fileKey !== body.options.fileKey) {
      return json({ error: "连接器当前打开的 Figma 文件与写入目标不一致" }, { status: 409 });
    }
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await saveJob({
      id,
      sessionId: body.sessionId,
      boards: body.boards,
      options: body.options,
      status: "queued",
      progress: { completed: 0, total: body.boards.length },
      activityAt: createdAt,
      createdAt,
    });
    return json({ jobId: id });
  }

  if (!body.jobId) return json({ error: "缺少写入任务 ID" }, { status: 400 });
  return await withJobLock(body.jobId, async () => {
    const job = await loadJob(body.jobId!);
    if (!job) return json({ error: "写入任务不存在或已过期" }, { status: 404 });
    if (body.action === "cancel") {
      const canCancel = (body.sessionId && body.sessionId === job.sessionId)
        || (body.claimToken && body.claimToken === job.claimToken);
      if (!canCancel) {
        return json({ error: "取消凭证已失效，请刷新连接状态后重试" }, { status: 409 });
      }
      if (job.status === "completed" || job.status === "failed") {
        return json({ error: "写入任务已经结束，无法取消" }, { status: 409 });
      }
      if (job.status === "cancelled") return json({ ok: true, cancelled: true });
      job.status = "cancelled";
      job.activityAt = Date.now();
      await saveJob(job);
      return json({ ok: true });
    }
    if (job.status === "cancelled") {
      return json({ error: "写入任务已取消", cancelled: true }, { status: 409 });
    }
    if (job.status === "completed" || job.status === "failed") {
      if (!body.claimToken || body.claimToken !== job.claimToken) {
        return json({ error: "写入任务凭证已失效，请回平台刷新状态" }, { status: 409 });
      }
      const sameTerminalState = (body.action === "complete" && job.status === "completed")
        || (body.action === "fail" && job.status === "failed");
      return sameTerminalState
        ? json({ ok: true, status: job.status })
        : json({ error: "写入任务已经结束", status: job.status }, { status: 409 });
    }
    if (job.status !== "claimed" || !body.claimToken || body.claimToken !== job.claimToken) {
      return json({ error: "写入任务凭证已失效，请回平台重试" }, { status: 409 });
    }
    if (body.action === "progress" && Number.isFinite(body.completed) && Number.isFinite(body.total)) {
      const total = Math.max(1, Math.round(body.total!));
      job.progress = {
        completed: Math.max(0, Math.min(total, Math.round(body.completed!))),
        total,
      };
      job.claimedAt = Date.now();
      job.activityAt = job.claimedAt;
      await saveJob(job);
      return json({ ok: true, progress: job.progress });
    }
    if (body.action === "complete" && body.result) {
      job.status = "completed";
      job.activityAt = Date.now();
      job.progress = { completed: job.progress?.total ?? job.boards.length, total: job.progress?.total ?? job.boards.length };
      job.result = body.result;
      await saveJob(job);
      return json({ ok: true });
    }
    if (body.action === "fail") {
      job.status = "failed";
      job.activityAt = Date.now();
      job.error = body.error ?? "Figma 插件写入失败";
      await saveJob(job);
      return json({ ok: true });
    }
    return json({ error: "无效的写入任务操作" }, { status: 400 });
  });
}
