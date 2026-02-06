# syntax=docker/dockerfile:1.7

# Standardized agent Dockerfile template.
# Generate per-agent Dockerfiles from this template to avoid drift.

ARG NODE_VERSION=20.19.0
ARG NODE_IMAGE=node:${NODE_VERSION}-alpine
ARG PNPM_VERSION=9.15.0
ARG AGENT_NAME=coordinator

FROM ${NODE_IMAGE} AS build
ARG PNPM_VERSION
ARG AGENT_NAME
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_PATH=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN test -n "${AGENT_NAME}"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/agents/package.json packages/agents/package.json
COPY packages/agents/base/package.json packages/agents/base/package.json
COPY packages/agents/${AGENT_NAME}/package.json packages/agents/${AGENT_NAME}/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --filter ./packages/agents/base --filter ./packages/agents/${AGENT_NAME}

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter ./packages/agents/base --filter ./packages/agents/${AGENT_NAME}

COPY packages/agents packages/agents

RUN pnpm --filter ./packages/agents/base build \
    && pnpm --filter ./packages/agents/${AGENT_NAME} build

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --offline --filter ./packages/agents/base --filter ./packages/agents/${AGENT_NAME} \
    && pnpm store prune

FROM ${NODE_IMAGE} AS runtime
ARG AGENT_NAME
RUN addgroup -g 1001 -S agent && adduser -S -D -H -u 1001 -G agent agent
WORKDIR /app
ENV NODE_ENV=production

RUN test -n "${AGENT_NAME}"
COPY --from=build --chown=agent:agent /workspace/node_modules /app/node_modules
COPY --from=build --chown=agent:agent /workspace/packages/agents/base/package.json /app/packages/agents/base/package.json
COPY --from=build --chown=agent:agent /workspace/packages/agents/base/dist /app/packages/agents/base/dist
COPY --from=build --chown=agent:agent /workspace/packages/agents/${AGENT_NAME}/package.json /app/packages/agents/${AGENT_NAME}/package.json
COPY --from=build --chown=agent:agent /workspace/packages/agents/${AGENT_NAME}/dist /app/packages/agents/${AGENT_NAME}/dist

RUN test -f packages/agents/${AGENT_NAME}/dist/index.js
RUN find /app -type f -name '*.map' -delete \
    && rm -rf /tmp/*

USER agent
EXPOSE 8080
CMD ["sh", "-c", "node packages/agents/${AGENT_NAME}/dist/index.js"]
