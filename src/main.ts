import "./styles.css";
import { Feed, type CharacterConfig } from "./feed";

// 默认占位人物：用程序化 DemoSource，零素材即可体验全部交互。
// 换成自己的视频时，把 type 改为 "video" 并填 src（见 public/characters.json）。
const FALLBACK: CharacterConfig[] = [
  { id: "a", name: "野原广志", subtitle: "Hiroshi Nohara", anime: { type: "demo" }, real: { type: "demo" } },
  { id: "b", name: "野原美冴", subtitle: "Misae Nohara", anime: { type: "demo" }, real: { type: "demo" } },
  { id: "c", name: "野原向日葵", subtitle: "Himawari Nohara", anime: { type: "demo" }, real: { type: "demo" } },
  { id: "d", name: "小白", subtitle: "Shiro", anime: { type: "demo" }, real: { type: "demo" } },
  { id: "e", name: "风间彻", subtitle: "Toru Kazama", anime: { type: "demo" }, real: { type: "demo" } },
];

async function loadCharacters(): Promise<CharacterConfig[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}characters.json`, {
      cache: "no-cache",
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as CharacterConfig[];
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    /* 用内置占位 */
  }
  return FALLBACK;
}

async function main(): Promise<void> {
  const app = document.getElementById("app")!;
  const characters = await loadCharacters();
  const feed = new Feed(characters);
  app.appendChild(feed.root);
  feed.start();
}

void main();
