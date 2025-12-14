/**
 * Dev Container Configuration Tests
 * Tests Gitpod-compatible Dev Container setup
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Dev Container Configuration', () => {
  
  describe('devcontainer.json', () => {
    const devcontainerPath = path.join(process.cwd(), '.devcontainer', 'devcontainer.json');
    
    it('should exist and be valid JSON', () => {
      expect(fs.existsSync(devcontainerPath)).toBe(true);
      
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config).toBeDefined();
    });

    it('should use image-based configuration (Gitpod-compatible)', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      // Gitpod uses image-based config, not docker-compose
      expect(config.image).toBeDefined();
      expect(config.image).toContain('devcontainers');
    });

    it('should specify remote user', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.remoteUser).toBe('vscode');
    });

    it('should configure Node.js feature', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.features).toBeDefined();
      expect(config.features['ghcr.io/devcontainers/features/node:1']).toBeDefined();
    });

    it('should forward essential ports', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.forwardPorts).toContain(5173); // Vite
      expect(config.forwardPorts).toContain(3001); // Backend API
    });

    it('should configure VSCode extensions', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.customizations).toBeDefined();
      expect(config.customizations.vscode).toBeDefined();
      expect(config.customizations.vscode.extensions).toBeDefined();
      expect(config.customizations.vscode.extensions).toContain('dbaeumer.vscode-eslint');
      expect(config.customizations.vscode.extensions).toContain('esbenp.prettier-vscode');
    });

    it('should configure environment variables', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.containerEnv).toBeDefined();
      expect(config.containerEnv.NODE_ENV).toBe('development');
      expect(config.containerEnv.ENVIRONMENT).toBe('development');
    });

    it('should have postCreateCommand for setup', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.postCreateCommand).toBeDefined();
      expect(config.postCreateCommand).toContain('npm install');
    });

    it('should configure Docker feature', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.features['ghcr.io/devcontainers/features/docker-outside-of-docker:1']).toBeDefined();
    });

    it('should configure GitHub CLI feature', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.features['ghcr.io/devcontainers/features/github-cli:1']).toBeDefined();
    });

    it('should configure port attributes', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.portsAttributes).toBeDefined();
      expect(config.portsAttributes['5173']).toBeDefined();
      expect(config.portsAttributes['5173'].label).toBe('Frontend (Vite)');
    });
  });
});
