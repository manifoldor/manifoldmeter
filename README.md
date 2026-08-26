# Manifold Meter

> Many models. One meter.

Manifold Meter 是一个本地优先的 Chrome 扩展，用来在工具栏和副屏中持续查看 AI 使用量。当前版本支持从已登录的 ChatGPT 会话读取 Codex 用量，并在两个界面中同步展示：

- 紧凑的浏览器工具栏弹窗
- 为 1136 × 640 横向副屏设计的常驻仪表盘

## 功能

- 5小时额度和本周额度展示
- 剩余百分比、额度重置时间和本周额度重置日期
- 可选的剩余积分展示
- 可用重置展示，并显示最早过期日期
- 根据用量状态变化的工具栏徽标
- 当接口返回积分时，在弹窗和仪表盘中同时显示剩余积分
- 用户明确同意连接后，仪表盘可见时每 1 分钟自动刷新；隐藏时由后台按 10 分钟间隔兜底刷新
- 副屏采用增量更新，仅修改发生变化的数字、进度和状态，不重新加载整页
- 请求超时、刷新去重，以及明确的过期/错误状态
- 弹窗打开时自动同步，并提供明确的数据过期提示
- 专为低亮度副屏设计的常驻仪表盘
- 不需要 Manifold 账号，不采集遥测，不使用远程存储

## 安装

1. 在 Chrome 地址栏打开 `chrome://extensions`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择整个 `manifold-meter` 文件夹。
5. 阅读首次连接页的数据说明，点击“同意并连接 Codex 数据”。
6. 确保 Chrome 已登录 ChatGPT，并打开一次 Codex 用量页面。
7. 点击扩展图标，在弹窗中选择“打开副屏”。

## 工作原理

用户明确同意连接后，Manifold Meter 通过当前浏览器中已经登录的
`chatgpt.com` 会话，读取 ChatGPT 使用的 Codex 用量接口返回的额度元数据。
在用户同意前，扩展不会读取 ChatGPT 会话、账户标识或 Codex 用量。

扩展会把同意状态和标准化后的额度快照保存在 `chrome.storage.local`。短期访问
令牌和 ChatGPT 账户 ID 只会临时保存在 Chrome 的内存会话存储
`storage.session` 中；浏览器重启或扩展重新加载后会被清除。扩展不会读取或
保存聊天内容、姓名、邮箱或 Cookie，也不会把认证信息或账户资料发送到开发者服务器。

| 权限 | 用途 |
|---|---|
| `storage` | 在本地保存连接同意状态、额度快照和刷新状态；在会话存储中短暂保存访问令牌与账户 ID |
| `alarms` | 在用户同意连接后定期刷新额度数据 |
| `chatgpt.com` 主机权限 | 从已登录来源读取 Codex 用量、额度和会话认证信息 |

Chrome 的主机权限会作用于整个 `https://chatgpt.com` 来源，即使代码只访问其中的特定路径。Manifold Meter 会将请求限制在 `background.js` 中列出的会话接口和 Codex 用量接口。

## 开发

```bash
npm install
npm run check
npm run package
npm run store:assets
```

`npm run package` 会根据明确的文件白名单在 `dist/` 中生成发布压缩包，避免把开发文件或依赖意外打包进去。

`npm run store:assets` 会使用真实本地界面和演示数据，重新生成 Chrome 应用商店截图和宣传图。

## 产品范围

Manifold Meter 这个名字刻意保持服务商中立。Codex 是第一个支持的数据源；未来可以通过独立适配器增加更多 AI 服务商，而不需要改变产品身份。

## 独立性与署名

Manifold Meter 是独立软件，与 OpenAI 无从属关系，也未获得 OpenAI 背书。

最初的 Codex 额度读取实现基于 MIT 许可的 Codex Quota Monitor 项目演化而来。原始版权声明已保留在 [LICENSE](LICENSE) 中。

## 许可证

MIT
