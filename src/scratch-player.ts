import { computeCover, type LayerSource } from "./sources";

export interface ScratchPlayerOptions {
  /** 刮开笔刷半径（CSS px）。 */
  brushRadius?: number;
  /** 长按进入"查看真人"的判定时长（ms）。 */
  longPressMs?: number;
  /** 判定为"滑动"而非"长按"的位移阈值（CSS px）。 */
  moveThreshold?: number;
  /** 刮开面积超过该比例时自动完全揭晓（0~1，<=0 关闭）。 */
  autoRevealRatio?: number;
  /** 自动揭晓 / 完全揭晓时的回调。 */
  onRevealed?: () => void;
}

interface DemoTickable {
  tick(tMs: number): void;
}
function hasTick(s: unknown): s is DemoTickable {
  return typeof (s as DemoTickable)?.tick === "function";
}

const MAX_DPR = 2;

/**
 * 刮刮乐播放器：
 * - 下层 canvas 画真人，上层 canvas 画动漫并用 mask 打孔露出真人。
 * - 滑动 = 刮开（痕迹持久保留）；长按 = 整层淡出看真人，松手恢复。
 */
export class ScratchPlayer {
  readonly root: HTMLDivElement;
  private bottom: HTMLCanvasElement;
  private top: HTMLCanvasElement;
  private bottomCtx: CanvasRenderingContext2D;
  private topCtx: CanvasRenderingContext2D;
  private mask: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;

  private anime: LayerSource;
  private real: LayerSource;
  private opts: Required<Omit<ScratchPlayerOptions, "onRevealed">> &
    Pick<ScratchPlayerOptions, "onRevealed">;

  private dpr = 1;
  private active = false;
  private rafId = 0;
  private ro: ResizeObserver;

  // 指针状态
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private moved = false;
  private longPressTimer = 0;
  private peeking = false;
  private revealed = false;

  // 自动揭晓采样节流
  private lastSampleAt = 0;

  constructor(
    anime: LayerSource,
    real: LayerSource,
    options: ScratchPlayerOptions = {}
  ) {
    this.anime = anime;
    this.real = real;
    this.opts = {
      brushRadius: options.brushRadius ?? 30,
      longPressMs: options.longPressMs ?? 300,
      moveThreshold: options.moveThreshold ?? 10,
      autoRevealRatio: options.autoRevealRatio ?? 0.6,
      onRevealed: options.onRevealed,
    };

    this.root = document.createElement("div");
    this.root.className = "sp-root";

    this.bottom = this.makeCanvas("sp-bottom");
    this.top = this.makeCanvas("sp-top");
    this.bottomCtx = this.bottom.getContext("2d")!;
    this.topCtx = this.top.getContext("2d")!;
    this.root.append(this.bottom, this.top);

    this.mask = document.createElement("canvas");
    this.maskCtx = this.mask.getContext("2d")!;

    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
  }

  private makeCanvas(cls: string): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.className = cls;
    return c;
  }

  /** 设备像素尺寸 = CSS 尺寸 × dpr（上限 MAX_DPR）。同时迁移已刮痕迹。 */
  private resize(): void {
    const rect = this.root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(rect.width * this.dpr);
    const h = Math.round(rect.height * this.dpr);
    if (this.top.width === w && this.top.height === h) return;

    // 迁移旧 mask（缩放到新尺寸），避免 resize 丢痕迹
    const old = document.createElement("canvas");
    old.width = this.mask.width || 1;
    old.height = this.mask.height || 1;
    old.getContext("2d")!.drawImage(this.mask, 0, 0);

    for (const c of [this.bottom, this.top, this.mask]) {
      c.width = w;
      c.height = h;
    }
    if (old.width > 1 && old.height > 1) {
      this.maskCtx.drawImage(old, 0, 0, old.width, old.height, 0, 0, w, h);
    }
  }

  private drawLayer(
    ctx: CanvasRenderingContext2D,
    src: LayerSource
  ): boolean {
    const d = src.getDrawable();
    if (!d || !src.ready) return false;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const { sx, sy, sw, sh } = computeCover(src.width, src.height, w, h);
    ctx.drawImage(d, sx, sy, sw, sh, 0, 0, w, h);
    return true;
  }

  private renderFrame = (tMs: number): void => {
    if (!this.active) return;
    if (hasTick(this.anime)) this.anime.tick(tMs);
    if (hasTick(this.real)) this.real.tick(tMs);

    // 下层：真人
    this.bottomCtx.clearRect(0, 0, this.bottom.width, this.bottom.height);
    this.drawLayer(this.bottomCtx, this.real);

    // 上层：动漫 + 用 mask 打孔
    const tc = this.topCtx;
    tc.globalCompositeOperation = "source-over";
    tc.clearRect(0, 0, this.top.width, this.top.height);
    if (!this.revealed) {
      this.drawLayer(tc, this.anime);
      tc.globalCompositeOperation = "destination-out";
      tc.drawImage(this.mask, 0, 0);
      tc.globalCompositeOperation = "source-over";
    }

    if (this.opts.autoRevealRatio > 0 && !this.revealed && !this.peeking) {
      this.maybeAutoReveal(tMs);
    }

    this.rafId = requestAnimationFrame(this.renderFrame);
  };

  /** 节流采样 mask 已刮比例，超阈值则完全揭晓。 */
  private maybeAutoReveal(tMs: number): void {
    if (tMs - this.lastSampleAt < 500) return;
    this.lastSampleAt = tMs;
    const sw = 48;
    const sh = Math.max(1, Math.round((sw * this.mask.height) / this.mask.width));
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    const tctx = tmp.getContext("2d")!;
    tctx.drawImage(this.mask, 0, 0, sw, sh);
    const data = tctx.getImageData(0, 0, sw, sh).data;
    let scratched = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 24) scratched++;
    }
    const ratio = scratched / (sw * sh);
    if (ratio >= this.opts.autoRevealRatio) this.reveal();
  }

  /** 完全揭晓：上层不再绘制（真人全显）。 */
  reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    this.top.classList.add("sp-revealed");
    this.opts.onRevealed?.();
  }

  // ---- 指针：滑动刮开 / 长按看真人 ----
  private bindPointer(): void {
    this.top.addEventListener("pointerdown", this.onDown);
    this.top.addEventListener("pointermove", this.onMove);
    this.top.addEventListener("pointerup", this.onUp);
    this.top.addEventListener("pointercancel", this.onUp);
  }

  private toMask(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.top.getBoundingClientRect();
    const fx = this.mask.width / rect.width;
    const fy = this.mask.height / rect.height;
    return { x: (clientX - rect.left) * fx, y: (clientY - rect.top) * fy };
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.top.setPointerCapture(e.pointerId);
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.moved = false;
    // 不在落点立即刮：长按 / 点按都不应留痕，只有确认为拖动后才刮开。
    this.longPressTimer = window.setTimeout(() => {
      if (!this.moved) this.enterPeek();
    }, this.opts.longPressMs);
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const dist = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
    if (!this.moved && dist > this.opts.moveThreshold) {
      this.moved = true;
      window.clearTimeout(this.longPressTimer);
      if (this.peeking) this.exitPeek();
    }
    if (this.moved && !this.peeking && !this.revealed) {
      const a = this.toMask(this.lastX, this.lastY);
      const b = this.toMask(e.clientX, e.clientY);
      this.scratchLine(a.x, a.y, b.x, b.y);
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    e.preventDefault();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    window.clearTimeout(this.longPressTimer);
    if (this.peeking) this.exitPeek();
    if (this.top.hasPointerCapture(e.pointerId)) {
      this.top.releasePointerCapture(e.pointerId);
    }
    this.pointerId = null;
  };

  private enterPeek(): void {
    this.peeking = true;
    this.top.classList.add("sp-peek");
  }
  private exitPeek(): void {
    this.peeking = false;
    this.top.classList.remove("sp-peek");
  }

  private scratchLine(x0: number, y0: number, x1: number, y1: number): void {
    const r = this.opts.brushRadius * this.dpr;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const step = Math.max(1, r * 0.35);
    const n = Math.ceil(dist / step);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n;
      this.paint(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }

  /** 在 mask 上画一个羽化软笔刷点（白色 = 该处打孔）。 */
  private paint(x: number, y: number): void {
    const r = this.opts.brushRadius * this.dpr;
    const ctx = this.maskCtx;
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 生命周期 ----
  activate(): void {
    if (this.active) return;
    this.active = true;
    this.resize();
    this.anime.play();
    this.real.play();
    this.rafId = requestAnimationFrame(this.renderFrame);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    cancelAnimationFrame(this.rafId);
    this.anime.pause();
    this.real.pause();
  }

  /** 清除刮痕，恢复到未刮状态。 */
  reset(): void {
    this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
    this.revealed = false;
    this.top.classList.remove("sp-revealed");
  }

  /** 给真人层声音开关用。 */
  setRealMuted(muted: boolean): void {
    const r = this.real as { setMuted?: (m: boolean) => void };
    r.setMuted?.(muted);
  }

  dispose(): void {
    this.deactivate();
    this.ro.disconnect();
    this.anime.dispose();
    this.real.dispose();
    this.root.remove();
  }
}
