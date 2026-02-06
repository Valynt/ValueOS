# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20.19.0
ARG PNPM_VERSION=9.15.0
ARG AGENT_NAME=intervention-designer

FROM node:${NODE_VERSION}-alpine AS build
ARG PNPM_VERSION
ARG AGENT_NAME
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/agents/package.json packages/agents/package.json
COPY packages/agents/base/package.json packages/agents/base/package.json
COPY packages/agents/${AGENT_NAME}/package.json packages/agents/${AGENT_NAME}/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter ./packages/agents/base --filter ./packages/agents/${AGENT_NAME}

COPY packages/agents packages/agents

RUN pnpm --filter ./packages/agents/base build \
    && pnpm --filter ./packages/agents/${AGENT_NAME} build

FROM node:${NODE_VERSION}-alpine AS runtime
ARG PNPM_VERSION
ARG AGENT_NAME=target
RUN addgroup -g 1001 -S agent && adduser -S -D -H -u 1001 -G agent agent
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/agents/package.json packages/agents/package.json
COPY packages/agents/base/package.json packages/agents/base/package.json
COPY packages/agents/${AGENT_NAME}/package.json packages/agents/${AGENT_NAME}/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter ./packages/agents/base --filter ./packages/agents/${AGENT_NAME} \
    && pnpm store prune

COPY --from=build --chown=agent:agent /workspace/packages/agents/base/dist packages/agents/base/dist
COPY --from=build --chown=agent:agent /workspace/packages/agents/${AGENT_NAME}/dist packages/agents/${AGENT_NAME}/dist

RUN find /app -type f -name '*.map' -delete \
    && rm -rf /pnpm/store /tmp/*

USER agent
EXPOSE 8080
CMD ["node", "packages/agents/intervention-designer/dist/index.js"]
