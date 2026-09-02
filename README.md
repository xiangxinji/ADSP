# ForgePilot · 铸航

**Autonomous Software Delivery Platform**（自主软件交付平台）

ForgePilot is an AI-native software engineering orchestration platform. It turns requirements into planned, verified code changes and coordinates existing delivery systems such as GitLab CI.

> 从需求启航，让软件自主交付。

The product is currently in the architecture-design stage. Read [Product Vision](docs/product-vision.md), [Architecture](docs/architecture.md), the current [Requirements & Assets specification](docs/requirements-assets.md), [UI size system](docs/ui-size-system.md), and [API contract](docs/api.md) before implementation.

## Setup

Use Node.js 22.19 or newer, then install dependencies:

```bash
npm install --legacy-peer-deps
```

## Development Server

Start the development server on `http://localhost:9085`:

```bash
npm run dev
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```

See [Repository Guidelines](AGENTS.md) for contribution and repository conventions.
