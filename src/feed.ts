import { ScratchPlayer } from "./scratch-player";
import { DemoSource, VideoSource, type LayerSource } from "./sources";

export interface MediaSpec {
  type: "video" | "demo";
  src?: string;
}

export interface CharacterConfig {
  id: string;
  name: string;
  subtitle?: string;
  anime: MediaSpec;
  real: MediaSpec;
}

function makeSource(
  spec: MediaSpec,
  variant: "anime" | "real",
  label: string,
  hue: number,
  muted: boolean
): LayerSource {
  if (spec.type === "video" && spec.src) {
    return new VideoSource({ src: spec.src, muted, loop: true });
  }
  return new DemoSource(variant, label, hue);
}

interface Slide {
  config: CharacterConfig;
  el: HTMLDivElement;
  player: ScratchPlayer | null;
}

/**
 * 竖向人物 feed：每个人物一个 slide，translateY 切换。
 * 切换通过按钮 / 滚轮 / 键盘（不抢"刮"的滑动手势）。
 */
export class Feed {
  readonly root: HTMLDivElement;
  private track: HTMLDivElement;
  private slides: Slide[] = [];
  private index = 0;
  private realMuted = true;
  private wheelLock = false;

  // 覆盖层 UI
  private nameChip: HTMLDivElement;
  private subChip: HTMLDivElement;

  constructor(characters: CharacterConfig[]) {
    this.root = document.createElement("div");
    this.root.className = "feed";

    this.track = document.createElement("div");
    this.track.className = "feed-track";
    this.root.appendChild(this.track);

    characters.forEach((config, i) => {
      const el = document.createElement("div");
      el.className = "slide";
      el.style.top = `${i * 100}%`;
      this.track.appendChild(el);
      this.slides.push({ config, el, player: null });
    });

    // 标签覆盖层
    const label = document.createElement("div");
    label.className = "label-overlay";
    this.nameChip = document.createElement("div");
    this.nameChip.className = "name-chip";
    this.subChip = document.createElement("div");
    this.subChip.className = "sub-chip";
    label.append(this.nameChip, this.subChip);
    this.root.appendChild(label);

    this.buildControls();
    this.bindGlobalGestures();
    window.addEventListener("resize", () => this.layout());
  }

  private buildControls(): void {
    const nav = document.createElement("div");
    nav.className = "nav";
    const up = this.iconBtn("‹", "上一个", () => this.go(this.index - 1));
    up.classList.add("nav-up");
    const down = this.iconBtn("›", "下一个", () => this.go(this.index + 1));
    down.classList.add("nav-down");
    nav.append(up, down);
    this.root.appendChild(nav);

    const tools = document.createElement("div");
    tools.className = "tools";
    const sound = this.iconBtn("🔇", "声音", () => this.toggleSound(sound));
    const reset = this.iconBtn("↺", "重刮", () => this.current?.player?.reset());
    tools.append(sound, reset);
    this.root.appendChild(tools);

    // 首屏提示
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "滑动刮开 · 长按看真人 · ↑↓ 切换人物";
    this.root.appendChild(hint);
    setTimeout(() => hint.classList.add("hide"), 3600);
  }

  private iconBtn(
    text: string,
    aria: string,
    onClick: () => void
  ): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "icon-btn";
    b.type = "button";
    b.textContent = text;
    b.setAttribute("aria-label", aria);
    b.addEventListener("click", onClick);
    return b;
  }

  private get current(): Slide | undefined {
    return this.slides[this.index];
  }

  private bindGlobalGestures(): void {
    // 滚轮 / 触控板切换
    this.root.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) < 8 || this.wheelLock) return;
        this.wheelLock = true;
        window.setTimeout(() => (this.wheelLock = false), 450);
        this.go(this.index + (e.deltaY > 0 ? 1 : -1));
      },
      { passive: true }
    );
    // 键盘
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") this.go(this.index + 1);
      else if (e.key === "ArrowUp") this.go(this.index - 1);
    });
  }

  /** 确保某 slide 的 player 已创建。 */
  private ensurePlayer(slide: Slide): ScratchPlayer {
    if (slide.player) return slide.player;
    const i = this.slides.indexOf(slide);
    const hue = (i * 47) % 360;
    const { config } = slide;
    const anime = makeSource(config.anime, "anime", config.name, hue, true);
    const real = makeSource(
      config.real,
      "real",
      config.name,
      hue,
      this.realMuted
    );
    const player = new ScratchPlayer(anime, real, {});
    slide.el.appendChild(player.root);
    slide.player = player;
    return player;
  }

  private go(to: number): void {
    const next = Math.max(0, Math.min(this.slides.length - 1, to));
    if (next === this.index && this.current?.player) return;
    const prev = this.current;
    this.index = next;
    if (prev && prev !== this.current) prev.player?.deactivate();
    this.layout();
    const slide = this.current!;
    const player = this.ensurePlayer(slide);
    player.setRealMuted(this.realMuted);
    player.activate();
    this.updateLabel();
  }

  private layout(): void {
    this.track.style.transform = `translateY(${-this.index * 100}%)`;
  }

  private updateLabel(): void {
    const c = this.current?.config;
    if (!c) return;
    this.nameChip.textContent = c.name;
    this.subChip.textContent = c.subtitle ?? "";
    this.subChip.style.display = c.subtitle ? "" : "none";
  }

  private toggleSound(btn: HTMLButtonElement): void {
    this.realMuted = !this.realMuted;
    btn.textContent = this.realMuted ? "🔇" : "🔊";
    this.current?.player?.setRealMuted(this.realMuted);
  }

  /** 挂载到页面并启动首个人物。 */
  start(): void {
    this.layout();
    const slide = this.current!;
    const player = this.ensurePlayer(slide);
    player.activate();
    this.updateLabel();
  }
}
