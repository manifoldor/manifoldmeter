# Chrome Web Store 隐私表单填写稿（2.0.5）

> 适用日期：2026-08-27。提交前必须让本文件、已上线的公开隐私政策、
> 商店详情和实际上传代码保持一致。本机处理或存储也属于数据处理，不能漏报。

## 单一用途

读取并在当前设备显示已登录用户的 Codex 用量、额度、剩余积分、重置时间
与同步状态。

## 权限理由

### `storage`

在当前设备保存用户的连接同意状态、标准化后的 Codex 额度快照、最近同步
时间和错误状态；短期访问令牌与 ChatGPT 账户 ID 只保存在内存型
`chrome.storage.session`，不使用同步存储。

### `alarms`

在用户明确同意连接后，每 10 分钟唤醒扩展后台，更新上述 Codex 用量数据。

### `https://chatgpt.com/*`

在用户明确同意连接后，从已登录的 ChatGPT 会话中取得短期认证信息与账户
标识，并读取 Codex 用量、额度、剩余积分和可用重置数据。Chrome 的主机权限
按整个来源授权，但扩展代码只访问以下路径及其页面：

- `/api/auth/session`
- `/backend-api/auth/session`
- `/backend-api/wham/usage`
- `/backend-api/wham/rate-limit-reset-credits`
- `/codex/*` 页面中的同源会话启动数据

## 远程代码

选择：**否，我没有使用远程代码 / No, I am not using remote code**。

所有 JavaScript 都包含在扩展安装包内。扩展会读取 HTTPS JSON 数据，但不会
下载、解释或执行远程 JavaScript、WebAssembly 或其他可执行代码。

## 用户数据类别

建议按以下保守口径勾选，名称以开发者后台实际显示为准：

| 类别 | 申报 | 说明 |
|---|---|---|
| Personally identifiable information | 是 | 处理 ChatGPT 账户 ID；只在内存会话存储中短暂保存，用于请求正确账户的数据 |
| Authentication information | 是 | 处理短期访问令牌；浏览器也可能向 chatgpt.com 同源请求附加现有认证 Cookie |
| Website content | 是 | 读取 Codex 用量 API 响应及 Codex 页面中的同源会话启动数据 |
| Financial and payment information | 是（保守申报） | 仅处理可能具有储值属性的剩余积分；不读取卡号、账单、交易或支付历史 |
| Web history | 否 | 不收集或保存用户访问过的网站、页面标题或 URL 历史 |
| User activity | 否 | 不记录点击、键盘输入、鼠标、滚动或其他浏览行为 |
| Personal communications | 否 | 不读取聊天提示、回复或其他通信内容 |
| Location、Health information | 否 | 不处理 |

如果开发者后台对 “Financial and payment information” 明确排除服务内积分余额，
可不勾选；否则保持保守申报。不要在未核对后台定义的情况下改成“否”。

## 数据使用认证

- 是否出售用户数据：否
- 是否用于或转移给个性化广告：否
- 是否用于与单一用途无关的信用评估或借贷：否
- 是否允许人工读取：否
- 是否传输到开发者控制的服务器：否
- 是否向第三方传输：仅向 `chatgpt.com` 发起提供核心功能所必需的请求
- 是否符合 Limited Use：是

后台第二组 Limited Use 认证项全部勾选，但只在本文件、公开政策和代码仍保持
上述行为时勾选。

Limited Use 声明：

> Manifold Meter 对从 Chrome 和 ChatGPT 获得的信息的使用遵守 Chrome Web
> Store 用户数据政策，包括 Limited Use（有限使用）要求。

## 显著披露与同意

扩展首次安装后，在连接按钮正上方显示：

> 连接后，扩展会从 chatgpt.com 读取短期认证信息、账户标识和 Codex 用量/剩余积分元数据，
> 仅用于在本机显示额度与同步状态，不发送到开发者服务器。查看隐私政策

用户必须点击 **“同意并连接 Codex 数据”** 才会保存同意状态并开始读取。
在此之前，后台闹钟、弹窗、副屏和 Codex 页面脚本均不会读取会话或用量数据。

## 隐私政策 URL

`https://manifoldor.github.io/manifoldmeter/privacy.html`

提交前打开该 URL，确认能看到“更新日期：2026 年 8 月 27 日”以及
“显著披露与同意”章节；如果仍显示 7 月版本，不要提交审核。
