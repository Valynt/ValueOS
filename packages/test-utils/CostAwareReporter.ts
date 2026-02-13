import { Reporter, TaskResultPack, Vitest } from 'vitest';
import fs from 'fs';

export default class CostAwareReporter implements Reporter {
  onFinished(files: TaskResultPack[], vitest: Vitest) {
    let totalCost = 0;
    let testCount = 0;
    for (const file of files) {
      for (const task of file.tasks) {
        if (task.meta && typeof task.meta.costInMicros === 'number') {
          totalCost += task.meta.costInMicros;
          testCount++;
        }
      }
    }
    const avgCost = testCount ? totalCost / testCount : 0;
    const report = {
      totalCostInMicros: totalCost,
      avgCostInMicros: avgCost,
      testCount,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync('vitest-cost-report.json', JSON.stringify(report, null, 2));
    // Optionally, print a warning if avg cost increased too much
    if (avgCost > (process.env.PRESET_BUDGET_THRESHOLD || 1000000)) {
      console.warn('[CostAwareReporter] Average test cost exceeds threshold!');
    }
  }
}
