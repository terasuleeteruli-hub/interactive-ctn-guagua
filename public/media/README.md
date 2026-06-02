# 放视频的地方

把每个人物的**两段全屏视频**放进这个目录（构图要完全一致，便于"完全重叠"）：

- `<id>-anime.mp4` —— 动漫那一段
- `<id>-real.mp4` —— 真人那一段

然后在 `public/characters.json` 里把对应人物改成：

```json
{
  "id": "hiroshi",
  "name": "野原广志",
  "subtitle": "Hiroshi Nohara",
  "anime": { "type": "video", "src": "media/hiroshi-anime.mp4" },
  "real":  { "type": "video", "src": "media/hiroshi-real.mp4" }
}
```

要点：
- 两段视频尺寸/构图尽量一致（程序会按 `object-fit: cover` 各自铺满，再像素级叠放）。
- 视频默认静音循环播放（移动端自动播放要求静音）；右下角 🔊 可单独给真人层开声。
- 用 `{ "type": "demo" }` 表示用程序化占位画面（无需任何文件）。
