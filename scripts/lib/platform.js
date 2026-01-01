#!/usr/bin/env node

/**
 * Platform Detection Module
 * Detects OS platform and architecture for platform-specific setup
 */

import os from 'os';
import { execSync } from 'child_process';

/**
 * Detect the current platform
 * @returns {'macos-intel'|'macos-silicon'|'wsl2'|'windows'|'linux'}
 */
export function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'win32') {
    try {
      const procVersion = execSync('cat /proc/version 2>/dev/null || echo ""', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const isWSL = procVersion.toLowerCase().includes('microsoft') || 
                    procVersion.toLowerCase().includes('wsl');
      return isWSL ? 'wsl2' : 'windows';
    } catch {
      return 'windows';
    }
  }

  if (platform === 'darwin') {
    return arch === 'arm64' ? 'macos-silicon' : 'macos-intel';
  }

  return 'linux';
}

/**
 * Get platform-specific configuration
 * @param {string} platform - Platform identifier
 * @returns {Object} Platform configuration
 */
export function getPlatformConfig(platform) {
  const configs = {
    'macos-intel': {
      name: 'macOS (Intel)',
      dockerCommand: 'open -a Docker',
      packageManager: 'npm',
      shell: 'zsh',
      pathSeparator: ':',
      homeDir: process.env.HOME,
      supportsRosetta: false,
      fileWatcherLimit: 524288,
      recommendations: [
        'Use Homebrew for package management',
        'Docker Desktop recommended',
        'Consider upgrading to Apple Silicon for better performance'
      ]
    },
    'macos-silicon': {
      name: 'macOS (Apple Silicon)',
      dockerCommand: 'open -a Docker',
      packageManager: 'npm',
      shell: 'zsh',
      pathSeparator: ':',
      homeDir: process.env.HOME,
      supportsRosetta: true,
      fileWatcherLimit: 524288,
      recommendations: [
        'Use Homebrew for package management',
        'Docker Desktop with Apple Silicon support',
        'Use ARM64-native images when available',
        'Rosetta 2 available for Intel-only dependencies'
      ]
    },
    'wsl2': {
      name: 'Windows (WSL2)',
      dockerCommand: 'docker',
      packageManager: 'npm',
      shell: 'bash',
      pathSeparator: ':',
      homeDir: process.env.HOME,
      supportsRosetta: false,
      fileWatcherLimit: 524288,
      recommendations: [
        'Keep code in WSL2 filesystem (not /mnt/c/)',
        'Use Docker Desktop with WSL2 backend',
        'Configure git to handle line endings: git config --global core.autocrlf input',
        'Install Node.js in WSL2, not Windows'
      ]
    },
    'windows': {
      name: 'Windows (Native)',
      dockerCommand: 'start docker',
      packageManager: 'npm',
      shell: 'powershell',
      pathSeparator: ';',
      homeDir: process.env.USERPROFILE,
      supportsRosetta: false,
      fileWatcherLimit: 524288,
      recommendations: [
        'WSL2 is strongly recommended for better compatibility',
        'If using native Windows, use PowerShell or Git Bash',
        'Docker Desktop required',
        'Configure git line endings: git config --global core.autocrlf true'
      ]
    },
    'linux': {
      name: 'Linux',
      dockerCommand: 'sudo systemctl start docker',
      packageManager: 'npm',
      shell: 'bash',
      pathSeparator: ':',
      homeDir: process.env.HOME,
      supportsRosetta: false,
      fileWatcherLimit: 524288,
      recommendations: [
        'Ensure user is in docker group: sudo usermod -aG docker $USER',
        'Increase file watcher limit: echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf',
        'Docker Engine recommended over Docker Desktop'
      ]
    }
  };

  return configs[platform] || configs['linux'];
}

/**
 * Display platform information
 */
export function displayPlatformInfo() {
  const platform = detectPlatform();
  const config = getPlatformConfig(platform);

  console.log(`\n🖥️  Platform: ${config.name}`);
  console.log(`📦 Package Manager: ${config.packageManager}`);
  console.log(`🐚 Shell: ${config.shell}`);
  
  if (config.recommendations.length > 0) {
    console.log(`\n💡 Recommendations:`);
    config.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  }

  return { platform, config };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const { platform, config } = displayPlatformInfo();
  console.log(`\n✅ Detected platform: ${platform}`);
}
