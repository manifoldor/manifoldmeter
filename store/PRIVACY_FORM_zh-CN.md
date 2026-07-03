# Chrome Web Store 隐私表单填写稿

> 提交前请让本文件、公开隐私政策、商店详情和实际代码保持一致。

## 单一用途

向已登录 ChatGPT 的用户显示 Codex 当前窗口和每周额度、重置时间、可选
Credits 余额及同步状态，并在 Chrome 工具栏显示当前窗口的剩余百分比。

## 权限理由

### `storage`

在当前设备保存标准化后的 Codex 额度快照、最近同步时间和错误状态；短期访问
令牌只保存在内存型 `chrome.storage.session`，不使用同步存储。

### `alarms`

每 10 分钟唤醒扩展后台，刷新用户主动安装本扩展所需的 Codex 用量数据。

### `https://chatgpt.com/*`

从用户已登录的 ChatGPT 会话端点取得短期认证信息，并从 Codex 用量端点读取
额度元数据。Chrome 的主机权限按整个来源授权，但扩展代码只请求
`/api/auth/session`、`/backend-api/auth/session` 和
`/backend-api/wham/usage`。

## 用户数据类别

建议按保守口径申报：

| 类别 | 申报 | 说明 |
|---|---|---|
| Authentication information | 是 | 短暂处理 ChatGPT 访问令牌；只在内存会话存储中保存 |
| Website content | 是 | 读取 Codex 用量 API 响应和 ChatGPT 页面中的会话启动数据 |
| Financial/payment information | 是 | 仅可能显示服务 Credits 余额；不读取银行卡、账单或交易明细 |
| Personally identifiable information | 是（仅瞬时接收并丢弃） | 会话响应可能包含账户属性；代码只提取令牌，不保存或使用这些属性 |
| Web history | 否 | 不记录用户访问过的网站或 URL |
| User activity | 否 | 不记录点击、键盘输入、鼠标或浏览行为 |
| Personal communications | 否 | 不读取聊天内容 |
| Location、Health information | 否 | 不处理 |

## 数据使用问题

- 是否出售用户数据：否
- 是否用于或转移给个性化广告：否
- 是否用于与单一用途无关的信用评估或借贷：否
- 是否允许人工读取：否
- 是否传输到开发者服务器：否
- 是否向第三方传输：仅向 `chatgpt.com` 发起提供核心功能所必需的同源请求
- 是否符合 Limited Use：是

Limited Use 声明：

> Manifold Meter 对从 Chrome 和 ChatGPT 获得的信息的使用遵守 Chrome Web
> Store 用户数据政策，包括 Limited Use（有限使用）要求。

## 显著披露文案

> Manifold Meter 使用你当前的 ChatGPT 登录状态读取 Codex 用量和可选
> Credits 余额。额度快照只保存在本机；短期访问令牌只保存在 Chrome
> 的内存会话中。数据不会发送到开发者服务器，也不会用于广告或销售。
