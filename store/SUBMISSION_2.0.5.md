# Manifold Meter 2.0.5 Chrome Web Store 提交稿

## 当前状态

- 提交包：`dist/manifold-meter-v2.0.5.zip`
- 文件数：19
- 大小：40,521 bytes
- SHA-256：`1ee03eb5aeddde937070cf9e891487c8ce60ded164d5fd260964a419db05751f`
- Manifest：V3
- 版本：2.0.5
- 远程代码：无
- 自动化检查：ESLint 通过，41/41 测试通过（含首次同意门禁）
- 商店素材：尺寸检查通过

公开页面尚未同步到当前 `docs/` 版本。在完成本文末尾“提交前必做”之前，
状态是 **安装包已就绪，但暂不应点击提交审核**。

## 1. Package

在 Developer Dashboard 新建项目后，上传：

`dist/manifold-meter-v2.0.5.zip`

后台读取出的版本应为 `2.0.5`，权限应只有：

- `storage`
- `alarms`
- `https://chatgpt.com/*`

## 2. Store listing

### Product name

`Manifold Meter`

### Summary

`在工具栏和副屏中安静显示 Codex 剩余额度、重置时间与同步状态。`

### Description

复制 `store/LISTING_zh-CN.md` 的“详细说明”正文。

### Category and language

- Category：Productivity
- Default language：简体中文
- Pricing：免费

### URLs

- Homepage：`https://manifoldor.github.io/manifoldmeter/`
- Support：`https://manifoldor.github.io/manifoldmeter/`
- Privacy policy：`https://manifoldor.github.io/manifoldmeter/privacy.html`
- Support email：`linyishan@gmail.com`

## 3. Graphic assets

建议上传顺序：

1. `store/assets/icon-128.png` — 128×128
2. `store/assets/screenshot-dashboard-1280x800.png` — 主功能
3. `store/assets/screenshot-popup-1280x800.png` — 工具栏弹窗
4. `store/assets/screenshot-onboarding-1280x800.png` — 首次连接与数据披露
5. `store/assets/promo-small-440x280.png` — 必填小型宣传图
6. `store/assets/promo-marquee-1400x560.png` — 可选 Marquee

三张截图均为 1280×800、无透明通道；宣传图尺寸已校验。

## 4. Privacy practices

### Single purpose

`读取并在当前设备显示已登录用户的 Codex 用量、额度、剩余积分、重置时间与同步状态。`

### Permission justifications

逐项复制 `store/PRIVACY_FORM_zh-CN.md` 的权限理由。重点保持：

- `storage` 包含连接同意状态、本地快照、错误状态和会话存储说明。
- `alarms` 明确只在用户同意连接后运行数据更新。
- 主机权限列出两个会话端点、用量端点、可用重置端点和 `/codex/*` 页面。

### Remote code

选择：`No, I am not using remote code.`

### Data types

勾选：

- Personally identifiable information
- Authentication information
- Website content
- Financial and payment information（按剩余积分可能具有储值属性的保守口径）

不勾选：

- Web history
- User activity
- Personal communications
- Location
- Health information

如果后台对 Financial and payment information 的定义明确排除服务内积分余额，
可根据后台定义不勾选；其余三项不得遗漏。

### Limited Use

按 `store/PRIVACY_FORM_zh-CN.md` 勾选全部适用认证。不得声明出售、广告、
信用评估、人工读取或传输到开发者服务器。

## 5. Distribution

- Visibility：Public
- Regions：All regions（若无法律或支持限制）
- Mature content：No

首次发布建议选择 deferred publishing。审核通过后先复核商店页面，再在允许的
发布时间窗内手动发布。

## 6. Reviewer test instructions

将以下英文复制到 Test instructions：

> Manifold Meter has one narrow purpose: it displays Codex usage, allowances,
> credit balance, reset metadata, and sync status for the ChatGPT account already
> signed in to Chrome. No separate Manifold account or API key is required.
>
> 1. Install the extension. The onboarding page opens automatically.
> 2. Before connecting, verify that the page prominently discloses the handled
>    data and that the primary button says “同意并连接 Codex 数据” (Agree and
>    connect Codex data). No ChatGPT session or usage request is initiated before
>    this action.
> 3. Click that button. A ChatGPT Codex usage page opens. Sign in with any
>    Codex-enabled ChatGPT account if Chrome is not already signed in.
> 4. Return to the onboarding page and wait for the success state, then open the
>    secondary-display dashboard. The toolbar popup opens from the extension icon.
> 5. Compare the displayed allowance/reset metadata with the ChatGPT Codex usage
>    page. Plus accounts may return both a 5-hour and weekly window; higher plans
>    may return only the weekly window. The UI only shows windows returned by the
>    service.
>
> The extension requests only chatgpt.com. It calls the session and Codex usage
> JSON endpoints and reads same-origin Codex bootstrap data. It does not read chat
> messages, browsing history, clicks, or keystrokes. It sends no data to servers
> controlled by the developer and executes no remote code.

如果审核后台要求测试账号，不要提交个人主账号密码。先确认 Chrome Web Store
是否接受由审核者使用自己的 Codex-enabled ChatGPT 账号；必要时另行准备专用、
可撤销的审核账号。

## 7. Release notes

复制 `store/RELEASE_NOTES_2.0.5.md`。如后台只允许简短更新说明，使用：

`优化副屏和弹窗视觉一致性、Plus/Pro 额度窗口显示、按数据变化局部刷新、首次连接流程与隐私披露，并移除手动刷新按钮。`

## 8. 提交前必做

- [ ] 将当前 `docs/` 部署到 GitHub Pages。
- [ ] 打开公开主页，确认能看到“首次连接前明确同意”的数据说明。
- [ ] 打开公开隐私政策，确认显示“更新日期：2026 年 8 月 27 日”。
- [ ] 确认公开隐私政策含“显著披露与同意”和账户 ID 会话存储说明。
- [ ] 用全新 Chrome 配置安装 ZIP；在点击同意前确认无 ChatGPT 会话/用量请求。
- [ ] 同意后分别验证未登录、Plus、Pro/更高套餐和断网状态。
- [ ] 确认支持邮箱可收信，开发者账号和发布者身份已验证。
- [ ] 完成 `store/RELEASE_CHECKLIST.md` 的其余人工项目。
- [ ] 上传 ZIP 和全部必填素材后，再点击 Submit for review。

## 9. 提交后

- 保存项目 ID、提交时间和后台截图。
- 审核期间不要让公开隐私页与提交声明发生不一致。
- 如被拒，保留完整拒审原因和政策编号，再针对原因修改；不要盲目扩大权限或
  删除披露。
