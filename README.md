# Control

Control is a desktop AI automation platform that lets users operate a computer with natural language. It focuses on local computer control, guided task execution, and workflow bridges for channels such as WeChat.

Current version: `0.2.12`.

## Product Focus

- Natural-language computer operation for routine desktop tasks.
- Local desktop automation with visual feedback and task history.
- WeChat task bridge for sending work instructions into the desktop agent.
- Report export, screen recording, and operator settings for demos and operations.

## Development

### Install Dependencies

```bash
pnpm install
```

### Start Desktop App

```bash
pnpm --filter control-desktop dev
```

### Build Desktop App

```bash
pnpm --filter control-desktop build
```

### Build Renderer/Main Bundle Only

```bash
pnpm --filter control-desktop build:dist
```

## Compliance

Control uses and adapts open-source GUI automation components, including components from ByteDance UI-TARS, under the Apache-2.0 license. The root `LICENSE` file and third-party license notices must remain in distributed builds.

See `THIRD_PARTY_NOTICES.md` for attribution notes.
