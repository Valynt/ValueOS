/**
 * Dev Container Configuration Tests (Dec 1, 2025 Fix)
 * Tests Docker Compose networking setup
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
      const config = JSON.parse(content.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      
      expect(config).toBeDefined();
    });

    it('should use Docker Compose configuration', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      
      expect(content).toContain('dockerComposeFile');
      expect(content).toContain('docker-compose.dev.yml');
    });

    it('should specify app service', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      
      expect(config.service).toBe('app');
    });

    it('should set workspace to /workspace', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      
      expect(config.workspaceFolder).toBe('/workspace');
    });

    it('should forward essential ports', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      
      expect(config.forwardPorts).toContain(5173); // Vite
      expect(config.forwardPorts).toContain(5432); // PostgreSQL
      expect(config.forwardPorts).toContain(6379); // Redis
    });

    it('should use vscode remote user', () => {
      const content = fs.readFileSync(devcontainerPath, 'utf-8');
      const config = JSON.parse(content.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      
      expect(config.remoteUser).toBe('vscode');
    });
  });

  describe('docker-compose.dev.yml', () => {
    const composePath = path.join(process.cwd(), 'docker-compose.dev.yml');
    
    it('should exist', () => {
      expect(fs.existsSync(composePath)).toBe(true);
    });

    it('should define app service', () => {
      const content = fs.readFileSync(composePath, 'utf-8');
      
      expect(content).toContain('services:');
      expect(content).toContain('app:');
    });

    it('should configure valuecanvas-network', () => {
      const content = fs.readFileSync(composePath, 'utf-8');
      
      expect(content).toContain('networks:');
      expect(content).toContain('valuecanvas-network');
    });

    it('should mount workspace correctly', () => {
      const content = fs.readFileSync(composePath, 'utf-8');
      
      expect(content).toContain('.:/workspace');
    });

    it('should set working_dir to /workspace', () => {
      const content = fs.readFileSync(composePath, 'utf-8');
      
      expect(content).toContain('working_dir: /workspace');
    });

    it('should define postgres on same network', () => {
      const content = fs.readFileSync(composePath, 'utf-8');
      
      expect(content).toContain('postgres:');
      expect(content).toMatch(/postgres:[\s\S]*valuecanvas-network/);
    });

    it('should define redis on same network', () => {
      const content = fs.readFileSync(composePath, 'utf-8');
      
      expect(content).toContain('redis:');
      expect(content).toMatch(/redis:[\s\S]*valuecanvas-network/);
    });
  });

  describe('Dockerfile.dev', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile.dev');
    
    it('should exist', () => {
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    it('should create vscode user', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      
      expect(content).toContain('vscode');
      expect(content).toMatch(/adduser.*vscode/);
    });

    it('should set WORKDIR to /workspace', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      
      expect(content).toContain('WORKDIR /workspace');
    });

    it('should install required tools', () => {
      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      
      expect(content).toContain('git');
      expect(content).toContain('curl');
      expect(content).toContain('bash');
    });
  });
});
