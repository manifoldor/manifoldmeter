# Chrome Web Store 提交材料

## 当前发布版本

- 扩展版本：2.0.4
- 安装包：`../dist/manifold-meter-v2.0.4.zip`
- 截图状态：已于 2026 年 7 月 5 日从当前界面重新生成并校验尺寸与可复现性

## 文件对应关系

| 商店字段 | 文件 |
|---|---|
| Store icon | `assets/icon-128.png` |
| Screenshot 1 | `assets/screenshot-dashboard-1280x800.png` |
| Screenshot 2 | `assets/screenshot-popup-1280x800.png` |
| Screenshot 3 | `assets/screenshot-onboarding-1280x800.png` |
| Small promo tile | `assets/promo-small-440x280.png` |
| Marquee promo tile（可选） | `assets/promo-marquee-1400x560.png` |
| 商店文案 | `LISTING_zh-CN.md` |
| 隐私表单填写稿 | `PRIVACY_FORM_zh-CN.md` |
| 发布检查表 | `RELEASE_CHECKLIST.md` |
| 2.0.4 更新说明 | `RELEASE_NOTES_2.0.4.md` |
| 2.0.3 历史更新说明 | `RELEASE_NOTES_2.0.3.md` |
| 2.0.2 历史更新说明 | `RELEASE_NOTES_2.0.2.md` |

截图与宣传图均由项目中的真实 HTML/CSS 和演示数据渲染，不包含真实账户数据。

## 公开网站

`docs/` 是可直接部署的静态站点：

- `docs/index.html`：产品主页
- `docs/privacy.html`：中英双语隐私政策

可将 `docs/` 部署到 GitHub Pages、Cloudflare Pages 或自有 HTTPS 域名。部署后
把实际主页和隐私政策 URL 填入商店后台及 `LISTING_zh-CN.md` 的占位符。

## 重新生成图片

macOS 安装 Chrome 后运行：

```bash
npm run store:assets
```

也可通过 `CHROME_PATH` 指定 Chrome/Chromium 可执行文件。
