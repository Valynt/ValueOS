#!/usr/bin/env node

import { workspaceVitestProjects } from './vitest-workspace-topology.mjs';

process.stdout.write(JSON.stringify(workspaceVitestProjects));
