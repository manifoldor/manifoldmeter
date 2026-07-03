# Chrome Web Store 发布清单

## 账号与公开页面

- [ ] 注册并验证 Chrome Web Store 开发者账号
- [ ] 填写发布者名称
- [x] 将 `docs/` 发布到公开 HTTPS 网站
- [x] 将商店文案更新为正式 GitHub Pages 地址
- [x] 确认主页可一键访问隐私政策
- [ ] 确认支持邮箱可正常收信

## 商店详情

- [ ] 使用 `LISTING_zh-CN.md` 填写名称、短说明和详细说明
- [ ] 分类选择 Productivity
- [ ] 默认语言选择简体中文
- [ ] 上传 `store/assets/icon-128.png`
- [ ] 上传至少一张 1280×800 截图
- [ ] 上传 440×280 小型宣传图
- [ ] 可选上传 1400×560 Marquee 图

## 隐私与权限

- [ ] 按 `PRIVACY_FORM_zh-CN.md` 填写单一用途
- [ ] 填写 `storage`、`alarms` 和 `chatgpt.com` 权限理由
- [ ] 数据类别与公开隐私政策一致
- [ ] 勾选 Limited Use 合规认证
- [ ] 确认未声明任何广告、出售或无关数据使用

## 技术验证

- [ ] 在全新 Chrome 配置中加载 `dist/manifold-meter-v2.0.2.zip`
- [ ] 验证未登录状态
- [ ] 验证 Plus/Pro 等实际套餐显示
- [ ] 验证工具栏显示剩余百分比
- [ ] 验证当前窗口、每周窗口和 Credits
- [ ] 对照 ChatGPT 用量页验证当前窗口的具体重置时刻
- [ ] 验证每周重置日期使用“X月X日”格式
- [ ] 验证断网、401、超时和旧数据提示
- [ ] 验证安装引导页和副屏全屏
- [x] 运行 `npm run check`
- [x] 运行 `npm run store:assets`
- [x] 运行 `npm run package`
