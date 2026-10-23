import { SCENE_COMPONENT_ASPECT, SCENE_UPLOAD_FOCUS_REGION, type SceneUploadCrop } from "@futu/domain";

export const UPLOAD_COMPONENT_WIDTH = 1884;
export const UPLOAD_COMPONENT_HEIGHT = 1096;
export const UPLOAD_COMPONENT_ASPECT = SCENE_COMPONENT_ASPECT;

/** Figma 主视觉规范 446:3756：重点视觉区域 x=457..1448、y=174..829。 */
export const UPLOAD_FOCUS_REGION = SCENE_UPLOAD_FOCUS_REGION;

export const UPLOAD_FEATHER_RATIOS = [0, 0.14, 0.26, 0.44] as const;
export const UPLOAD_FEATHER_HOLDS = [0, 0, 0.08, 0.2] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/**
 * 原图先等比铺满固定重点视觉区域，再按用户的中心点与倍数裁切。
 * image 返回 1884×1096 组件内的归一化外框，crop 是约束后的稳定值。
 */
export function uploadCropLayout(imageAspect: number, value?: Partial<SceneUploadCrop>, componentAspect = UPLOAD_COMPONENT_ASPECT) {
  const aspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1;
  const componentHeight = UPLOAD_COMPONENT_HEIGHT;
  const componentWidth = componentHeight * (Number.isFinite(componentAspect) && componentAspect > 0 ? componentAspect : UPLOAD_COMPONENT_ASPECT);
  const minCropWidth = 120 / componentWidth;
  const minCropHeight = 90 / componentHeight;
  const requested = value?.frame ?? UPLOAD_FOCUS_REGION;
  const frame = {
    w: clamp(Number.isFinite(requested.w) ? requested.w : UPLOAD_FOCUS_REGION.w, minCropWidth, 1),
    h: clamp(Number.isFinite(requested.h) ? requested.h : UPLOAD_FOCUS_REGION.h, minCropHeight, 1),
    x: 0,
    y: 0,
  };
  frame.x = clamp(Number.isFinite(requested.x) ? requested.x : UPLOAD_FOCUS_REGION.x, 0, 1 - frame.w);
  frame.y = clamp(Number.isFinite(requested.y) ? requested.y : UPLOAD_FOCUS_REGION.y, 0, 1 - frame.h);
  const focus = {
    x: frame.x * componentWidth,
    y: frame.y * componentHeight,
    w: frame.w * componentWidth,
    h: frame.h * componentHeight,
  };
  const regionAspect = focus.w / focus.h;
  const zoom = clamp(Number.isFinite(value?.zoom) ? value!.zoom! : 1, 1, 4);
  let width: number;
  let height: number;
  if (aspect >= regionAspect) {
    height = focus.h * zoom;
    width = height * aspect;
  } else {
    width = focus.w * zoom;
    height = width / aspect;
  }
  const halfVisibleX = focus.w / (2 * width);
  const halfVisibleY = focus.h / (2 * height);
  const x = clamp(Number.isFinite(value?.x) ? value!.x! : 0.5, halfVisibleX, 1 - halfVisibleX);
  const y = clamp(Number.isFinite(value?.y) ? value!.y! : 0.5, halfVisibleY, 1 - halfVisibleY);
  return {
    crop: { zoom, x, y, frame },
    frame,
    image: {
      x: (focus.x + focus.w / 2 - x * width) / componentWidth,
      y: (focus.y + focus.h / 2 - y * height) / componentHeight,
      w: width / componentWidth,
      h: height / componentHeight,
    },
  };
}
