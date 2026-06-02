# interactive-ctn-guagua

漫改真人 · **互动刮刮乐视频**。同一人物有两段**完全重叠**的全屏视频：上层动漫、下层真人。

## 玩法
- **滑动刮开**：手指在画面上滑动，像刮刮乐一样刮开上层动漫，露出下层真人；**刮过的痕迹会保留**。
- **长按看真人**：按住不动，上层动漫淡出直接显示真人；**松手恢复**，已刮痕迹仍在。
- **上下切换人物**：右侧 `‹ / ›` 按钮、鼠标滚轮 / 触控板、或键盘 `↑ ↓`（切换不占用"刮"的滑动手势）。
- **刮净自动揭晓**：刮开面积够大时自动完全显示真人。
- 右下角 `🔇/🔊` 给真人层开关声音，`↺` 重刮当前人物。

## 运行
```bash
npm install
npm run dev      # 本地开发，浏览器打开提示的地址（手机同局域网也可访问）
npm run build    # 类型检查 + 产物打包到 dist/
npm run preview  # 预览打包产物
```
开箱即跑：默认用程序化占位画面演示全部交互，**无需任何视频文件**。

## 换成自己的视频
1. 把两段全屏视频放进 `public/media/`（构图保持一致）。
2. 在 `public/characters.json` 把对应人物的 `anime`/`real` 改成
   `{ "type": "video", "src": "media/xxx.mp4" }`。

详见 `public/media/README.md`。

## 结构
- `src/sources.ts` —— 图层源（`VideoSource` / 程序化 `DemoSource`）与 cover 裁剪。
- `src/scratch-player.ts` —— 刮刮乐核心：双 canvas + mask 打孔、滑动刮开 / 长按看真人。
- `src/feed.ts` —— 竖向人物 feed 与切换、覆盖层 UI。
- `src/main.ts` —— 加载配置并启动。
