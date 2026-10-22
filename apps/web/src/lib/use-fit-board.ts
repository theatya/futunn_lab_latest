"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 让画板预览吃掉容器里能用的最大面积，同时保持真实宽高比。
 * 全屏工作区里预览框会跟着窗口变，不再写死 420px。
 */
export function useFitBoard(boardW: number, boardH: number, pad = 24, minSize = 80) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);

  useEffect(() => {
    const el = ref.current;
    if (!el || boardW <= 0 || boardH <= 0) return;

    const fit = (cw: number, ch: number) => {
      const availW = Math.max(minSize, cw - pad);
      const availH = Math.max(minSize, ch - pad);
      const byWidth = availW;
      const byHeight = availH * (boardW / boardH);
      setWidth(Math.floor(Math.min(byWidth, byHeight)));
    };

    fit(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) fit(box.width, box.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardW, boardH, minSize, pad]);

  return { ref, width };
}
