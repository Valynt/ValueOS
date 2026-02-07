#!/usr/bin/env node

/**
 * Progress Tracking System
 * Visual progress feedback for long-running operations
 */

/**
 * Simple progress bar implementation
 */
export class ProgressBar {
  constructor(total, description = '') {
    this.total = total;
    this.current = 0;
    this.description = description;
    this.startTime = Date.now();
  }

  /**
   * Update progress
   */
  tick(increment = 1, description = null) {
    this.current += increment;
    if (description) {
      this.description = description;
    }
    this.render();
  }

  /**
   * Render progress bar
   */
  render() {
    const percentage = Math.min(100, Math.floor((this.current / this.total) * 100));
    const filled = Math.floor(percentage / 5);
    const empty = 20 - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const rate = this.current / elapsed || 0;
    const remaining = rate > 0 ? Math.ceil((this.total - this.current) / rate) : 0;
    
    const timeStr = remaining > 0 
      ? `ETA: ${remaining}s` 
      : `${elapsed}s`;
    
    process.stdout.write(`\r[${bar}] ${percentage}% | ${this.description} | ${timeStr}`);
    
    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  /**
   * Complete the progress bar
   */
  complete(message = 'Complete!') {
    this.current = this.total;
    this.description = message;
    this.render();
  }
}

/**
 * Progress tracker for multiple steps
 */
export class ProgressTracker {
  constructor(steps) {
    this.steps = steps;
    this.currentStep = 0;
    this.bar = new ProgressBar(steps.length, steps[0] || 'Starting...');
  }

  /**
   * Run a step with progress tracking
   */
  async runStep(name, fn) {
    this.bar.tick(0, name);
    
    try {
      await fn();
      this.currentStep++;
      this.bar.tick(1, name);
      return { success: true, step: name };
    } catch (error) {
      return { success: false, step: name, error };
    }
  }

  /**
   * Complete all steps
   */
  complete() {
    this.bar.complete('All steps complete!');
  }
}

/**
 * Spinner for indeterminate operations
 */
export class Spinner {
  constructor(message = 'Loading...') {
    this.message = message;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.frameIndex = 0;
    this.interval = null;
  }

  /**
   * Start spinner
   */
  start() {
    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      process.stdout.write(`\r${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
    return this;
  }

  /**
   * Update message
   */
  update(message) {
    this.message = message;
    return this;
  }

  /**
   * Stop with success
   */
  succeed(message = null) {
    this.stop();
    console.log(`✅ ${message || this.message}`);
    return this;
  }

  /**
   * Stop with failure
   */
  fail(message = null) {
    this.stop();
    console.log(`❌ ${message || this.message}`);
    return this;
  }

  /**
   * Stop with warning
   */
  warn(message = null) {
    this.stop();
    console.log(`⚠️  ${message || this.message}`);
    return this;
  }

  /**
   * Stop spinner
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write('\r\x1b[K'); // Clear line
    }
    return this;
  }
}

/**
 * Create a spinner
 */
export function spinner(message) {
  return new Spinner(message);
}

/**
 * Create a progress bar
 */
export function progressBar(total, description) {
  return new ProgressBar(total, description);
}

/**
 * Create a progress tracker
 */
export function progressTracker(steps) {
  return new ProgressTracker(steps);
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    // Spinner demo
    const spin = spinner('Loading data...').start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    spin.succeed('Data loaded');

    // Progress bar demo
    console.log('\nProgress bar demo:');
    const bar = progressBar(100, 'Processing');
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      bar.tick(1, `Processing item ${i + 1}`);
    }

    // Progress tracker demo
    console.log('\nProgress tracker demo:');
    const tracker = progressTracker([
      'Step 1',
      'Step 2',
      'Step 3',
      'Step 4',
      'Step 5'
    ]);

    for (let i = 0; i < 5; i++) {
      await tracker.runStep(`Step ${i + 1}`, async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });
    }

    tracker.complete();
  }

  demo();
}
