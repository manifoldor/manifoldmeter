# Chrome Web Store 商店文案

## 名称

Manifold Meter

## 简短说明

在工具栏和副屏中安静显示 Codex 剩余额度、重置时间与同步状态。

## 详细说明

把 Codex 用量放到余光里。

Manifold Meter 是一个本地优先的 Codex 用量仪表盘。它使用你在 Chrome
中现有的 ChatGPT 登录状态，读取并显示：

- 当前用量窗口或动态额度状态
- 可用的剩余百分比、具体重置时刻和周重置日期
- 工具栏弹窗与副屏中的可选 Credits 余额
- 可用重置次数和最早过期日期
- 工具栏剩余额度徽标
- 适合横向副屏常驻显示的低亮度仪表盘
- 数据过期、登录失效和同步失败状态

如果当前套餐返回窗口额度，扩展会以本地时间显示具体重置时刻；如果返回
周额度，则以“X月X日”显示重置日期。对于按 Credits 或动态限额计算的
套餐，界面会显示 Credits/动态限额状态，避免展示错误百分比。

隐私优先：

- 不需要 Manifold 账户或 API Key
- 不读取聊天内容
- 不记录浏览历史
- 不包含遥测或广告
- 额度快照只保存在当前设备
- 短期认证令牌只保存在 Chrome 的内存会话中
- 不向开发者服务器上传用量或账户数据

副屏仪表盘可见时每 1 分钟自动刷新；隐藏时由后台每 10 分钟协调刷新，
同时支持手动刷新。Chrome 对 `chatgpt.com` 的主机权限按整个来源授权，
但本扩展只访问 ChatGPT 会话端点和 Codex 用量端点，以提供上述单一功能。

Manifold Meter 是独立软件，与 OpenAI 无隶属、赞助或认可关系。

## 分类与语言

- 建议分类：Productivity / 生产力工具
- 默认语言：简体中文
- 分发地区：全部支持地区

## 提交字段

- 主页 URL：`https://manifoldor.github.io/manifoldmeter/`
- 隐私政策 URL：`https://manifoldor.github.io/manifoldmeter/privacy.html`
- 支持 URL：`https://manifoldor.github.io/manifoldmeter/`
- 支持邮箱：`linyishan@gmail.com`

## 审核备注

The extension has one purpose: displaying the signed-in user's Codex usage,
allowance, credits, and reset metadata. It does not read chat content or browsing history.
It sends no data to developer-controlled servers. Authentication data is held
only in Chrome's in-memory session storage. The `chatgpt.com` host permission
is required because Chrome host permissions are origin-scoped; the extension
only calls the session and Codex usage endpoints described in the listing and
privacy policy.
