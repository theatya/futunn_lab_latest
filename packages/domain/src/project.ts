/**
 * Project 是这个平台的一等公民。
 *
 * 一次活动 = 一份内容 + 一批目标画幅 + 一套共用版式 + 若干块板的单独覆盖。
 * 「生成」永远是**从 Project 重新解一遍**，而不是去改已经生成的 Figma 节点 ——
 * 重新生成比依赖组件联动可靠得多。
 */

import type { Content } from "./content";
import type { BoardConfig } from "./layout";

/** 一块要出的板 */
export interface TargetBoard {
  /** `${w}×${h}`，同尺寸只出现一次 */
  key: string;
  w: number;
  h: number;
  /** 尺寸清单里的 id，用于查规范；自定义尺寸为 null */
  sizeId: string | null;
  use: string;
}

export interface CampaignProjectConfig {
  id: string;
  version: string;
  scenarioId?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;

  /** 普通延展与专项延展共用同一项目模型；专项规则由 campaign 配置驱动。 */
  mode?: "standard" | "campaign";
  campaign?: CampaignProjectConfig;

  content: Content;

  /** 这一批要出哪些板 */
  targets: TargetBoard[];

  /** 共用版式设置，默认所有板都跟着它走 */
  shared: BoardConfig;

  /**
   * 单独调过的板。key 是 TargetBoard.key。
   * 没有条目 = 跟随共用；有条目 = 这块板从此不再跟随。
   */
  overrides: Record<string, BoardConfig>;
}

/** 生成任务的一次运行记录 */
export interface GenerateRun {
  id: string;
  projectId: string;
  startedAt: string;
  finishedAt?: string;
  status: "pending" | "running" | "done" | "failed" | "partial";
  /** 目标 Figma 文件 */
  fileKey?: string;
  /** 每块板的结果 */
  boards: Array<{
    key: string;
    lang: string;
    status: "pending" | "done" | "failed";
    nodeId?: string;
    error?: string;
  }>;
}

export function boardConfigOf(project: Project, key: string): BoardConfig {
  return project.overrides[key] ?? project.shared;
}

export function isOverridden(project: Project, key: string): boolean {
  return key in project.overrides;
}
