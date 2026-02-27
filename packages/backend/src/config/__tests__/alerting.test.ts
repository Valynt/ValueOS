import { describe, expect, it } from 'vitest';
import { ALERT_RULES, getAlertRuleById } from '../alerting.js'

describe('alerting configuration', () => {
  describe('getAlertRuleById', () => {
    it('returns the correct alert rule when ID exists', () => {
      const rule = getAlertRuleById('high-error-rate');
      
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('high-error-rate');
      expect(rule?.name).toBe('High Agent Error Rate');
      expect(rule?.enabled).toBe(true);
      expect(rule?.thresholds).toHaveLength(2);
    });

    it('returns undefined when ID does not exist', () => {
      const rule = getAlertRuleById('non-existent-rule');
      
      expect(rule).toBeUndefined();
    });

    it('returns the correct rule for each configured alert', () => {
      const testIds = ['high-hallucination-rate', 'low-confidence', 'slow-response-time'];
      
      testIds.forEach(id => {
        const rule = getAlertRuleById(id);
        expect(rule).toBeDefined();
        expect(rule?.id).toBe(id);
      });
    });

    it('matches rules from ALERT_RULES array', () => {
      ALERT_RULES.forEach(expectedRule => {
        const foundRule = getAlertRuleById(expectedRule.id);
        expect(foundRule).toBe(expectedRule);
      });
    });
  });
});
