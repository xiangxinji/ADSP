FROM node:24-bookworm-slim

ARG CODEX_VERSION=0.153.4
ARG CLAUDE_CODE_VERSION=2.1.161

RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global @openai/codex@${CODEX_VERSION} @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

USER node
WORKDIR /home/node
