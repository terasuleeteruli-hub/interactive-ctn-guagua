# 怎么换成你自己的视频

每个人物需要**两段构图一致的全屏视频**：一段动漫、一段真人。配置都写在
`public/characters.json`，每个人物的 `anime` / `real` 两项各填一段视频。

## 方式一：外部链接 URL（推荐，不撑大仓库）

把视频传到图床 / 对象存储（OSS、COS、S3 等）/ CDN，拿到直链后填进去：

```json
{
  "id": "hiroshi",
  "name": "野原广志",
  "subtitle": "Hiroshi Nohara",
  "anime": { "type": "video", "src": "https://你的域名/hiroshi-anime.mp4" },
  "real":  { "type": "video", "src": "https://你的域名/hiroshi-real.mp4" }
}
```

注意事项：
- **必须是 https**。线上站点是 https，填 http 链接会被浏览器按"混合内容"拦掉。
- 格式建议 **MP4 / H.264**（兼容性最好），手机端友好。
- 跨域**不需要** CORS 头也能正常播放、刮开（本应用不读取视频像素）。
- 直链要能被 `<video>` 直接播放（有些网盘是页面链接而非文件直链，不行）。

## 方式二：放进仓库

把文件放到本目录 `public/media/`，再用相对路径引用：

```json
"anime": { "type": "video", "src": "media/hiroshi-anime.mp4" },
"real":  { "type": "video", "src": "media/hiroshi-real.mp4" }
```

适合几 MB 的小片段；大文件不建议进 git。

## 通用要点
- 两段视频尺寸/构图尽量一致（程序按 `object-fit: cover` 各自铺满，再像素级叠放）。
- 默认静音循环播放（移动端自动播放要求静音）；右下角 🔊 可单独给真人层开声。
- `{ "type": "demo" }` = 程序化占位画面，无需任何文件。
- 改完推送到 `main` 即自动重新部署到 GitHub Pages。
