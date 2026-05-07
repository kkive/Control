# Control

Control 是一款桌面 AI 自动化产品，用户可以用自然语言指挥电脑完成任务。当前版本重点面向本地电脑操作、任务执行过程可视化，以及微信等外部渠道的任务接入。

当前版本：`0.2.12`。

## 产品定位

- 使用自然语言操作电脑，降低复杂桌面任务的执行门槛。
- 支持本地电脑自动化、任务记录、过程反馈和报告导出。
- 支持个人微信任务桥接，将外部指令接入桌面自动化流程。
- 支持录屏、水印、日志导出和操作员配置，便于演示、复盘和交付。

## 启动命令

### 安装依赖

```bash
pnpm install
```

### 开发启动

```bash
pnpm --filter control-desktop dev
```

### 编译构建

```bash
pnpm --filter control-desktop build
```

### 仅构建桌面应用代码

```bash
pnpm --filter control-desktop build:dist
```

## 合规说明

Control 使用并改造了开源 GUI 自动化组件，其中包括 ByteDance UI-TARS 相关组件，相关代码遵循 Apache-2.0 许可证。分发版本中应保留根目录 `LICENSE` 文件以及第三方许可证声明。

第三方开源组件说明见 `THIRD_PARTY_NOTICES.md`。
