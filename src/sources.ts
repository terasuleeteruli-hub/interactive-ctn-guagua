// 图层源抽象：动漫层与真人层都通过统一接口取帧，
// 这样两层用完全相同的 cover 变换绘制，做到像素级"完全重叠"。

export interface CoverRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * 计算把 src 尺寸以 object-fit: cover 方式铺满 dst 时，
 * 需要从源图截取的矩形（居中裁剪）。
 */
export function computeCover(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): CoverRect {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, srcW), sh: Math.max(1, srcH) };
  }
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  let sw = srcW;
  let sh = srcH;
  if (srcRatio > dstRatio) {
    // 源更宽：左右裁剪
    sw = srcH * dstRatio;
  } else {
    // 源更高：上下裁剪
    sh = srcW / dstRatio;
  }
  const sx = (srcW - sw) / 2;
  const sy = (srcH - sh) / 2;
  return { sx, sy, sw, sh };
}

/** 可被 drawImage 直接绘制的源帧。 */
export type Drawable =
  | HTMLVideoElement
  | HTMLCanvasElement
  | HTMLImageElement;

export interface LayerSource {
  /** 是否已经可以绘制（有有效尺寸的一帧）。 */
  readonly ready: boolean;
  /** 源的固有宽度（像素）。 */
  readonly width: number;
  /** 源的固有高度（像素）。 */
  readonly height: number;
  /** 取当前可绘制帧。 */
  getDrawable(): Drawable | null;
  /** 激活：开始播放/动画。 */
  play(): void;
  /** 失活：暂停以省资源。 */
  pause(): void;
  /** 彻底释放。 */
  dispose(): void;
}

export interface VideoSourceOptions {
  src: string;
  muted?: boolean;
  loop?: boolean;
}

/** 基于 <video> 的图层源（用户真实的动漫 / 真人视频）。 */
export class VideoSource implements LayerSource {
  readonly el: HTMLVideoElement;
  private _ready = false;

  constructor(opts: VideoSourceOptions) {
    const v = document.createElement("video");
    v.src = opts.src;
    v.muted = opts.muted ?? true;
    v.loop = opts.loop ?? true;
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    // 不显示元素本体，只作为绘制源（保留在 DOM 以便部分浏览器解码）。
    v.style.position = "absolute";
    v.style.width = "1px";
    v.style.height = "1px";
    v.style.opacity = "0";
    v.style.pointerEvents = "none";
    v.setAttribute("aria-hidden", "true");
    v.addEventListener("loadeddata", () => {
      this._ready = v.videoWidth > 0 && v.videoHeight > 0;
    });
    this.el = v;
    document.body.appendChild(v);
  }

  get ready(): boolean {
    return this._ready && this.el.readyState >= 2;
  }
  get width(): number {
    return this.el.videoWidth || 0;
  }
  get height(): number {
    return this.el.videoHeight || 0;
  }
  getDrawable(): Drawable | null {
    return this.ready ? this.el : null;
  }
  play(): void {
    const p = this.el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }
  pause(): void {
    this.el.pause();
  }
  dispose(): void {
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    this.el.remove();
  }

  /** 取消静音（用于真人层的声音开关）。 */
  setMuted(muted: boolean): void {
    this.el.muted = muted;
  }
}

export type DemoVariant = "anime" | "real";

/**
 * 程序化占位源：在离屏 canvas 上画动态画面，
 * 让工程零素材也能跑、演示完整交互。换成自己的视频后即可移除。
 */
export class DemoSource implements LayerSource {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly width = 720;
  readonly height = 1280;
  private rafActive = false;
  private label: string;
  private variant: DemoVariant;
  private hue: number;

  constructor(variant: DemoVariant, label: string, hue: number) {
    this.variant = variant;
    this.label = label;
    this.hue = hue;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d")!;
    this.draw(0);
  }

  get ready(): boolean {
    return true;
  }
  getDrawable(): Drawable {
    return this.canvas;
  }
  play(): void {
    this.rafActive = true;
  }
  pause(): void {
    this.rafActive = false;
  }
  dispose(): void {
    this.rafActive = false;
  }

  /** 由 ScratchPlayer 的渲染循环驱动，确保画面在动。 */
  tick(tMs: number): void {
    if (this.rafActive) this.draw(tMs);
  }

  private draw(tMs: number): void {
    const { ctx, width: w, height: h } = this;
    const t = tMs / 1000;
    if (this.variant === "anime") {
      // 动漫层：高饱和平涂渐变 + 漂浮圆形
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `hsl(${this.hue}, 85%, 78%)`);
      g.addColorStop(1, `hsl(${(this.hue + 40) % 360}, 80%, 62%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        const x = w * (0.2 + 0.6 * ((i / 6 + t * 0.05) % 1));
        const y = h * (0.15 + 0.7 * ((i * 0.17 + t * 0.07) % 1));
        ctx.fillStyle = `hsla(${(this.hue + i * 30) % 360}, 90%, 85%, 0.55)`;
        ctx.beginPath();
        ctx.arc(x, y, 70 + 20 * Math.sin(t + i), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 64px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("动漫 ANIME", w / 2, h * 0.5);
    } else {
      // 真人层：低饱和"照片感"渐变 + 扫描感横纹
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `hsl(${this.hue}, 22%, 28%)`);
      g.addColorStop(1, `hsl(${(this.hue + 20) % 360}, 18%, 14%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      const shift = (t * 30) % 24;
      for (let y = -24 + shift; y < h; y += 24) {
        ctx.fillRect(0, y, w, 12);
      }
      const glow = ctx.createRadialGradient(
        w / 2,
        h * 0.42,
        40,
        w / 2,
        h * 0.42,
        420
      );
      glow.addColorStop(0, "rgba(255,230,200,0.35)");
      glow.addColorStop(1, "rgba(255,230,200,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 60px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("真人 REAL", w / 2, h * 0.52);
      ctx.font = "500 40px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(this.label, w / 2, h * 0.6);
    }
  }
}
