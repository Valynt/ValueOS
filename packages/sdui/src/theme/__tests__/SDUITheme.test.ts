import { describe, expect, it } from 'vitest';

import { generateInlineStyles, getSDUIStyles, SDUIComponentStyles } from '../SDUITheme';

describe('SDUITheme', () => {
  describe('getSDUIStyles', () => {
    it('should return the correct styles for a simple component like card', () => {
      const result = getSDUIStyles('card');
      expect(result).toEqual(SDUIComponentStyles.card);
      expect(result).toHaveProperty('background');
      expect(result).toHaveProperty('hover');
    });

    it('should return the correct styles for a complex component like button', () => {
      const result = getSDUIStyles('button');
      expect(result).toEqual(SDUIComponentStyles.button);
      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('secondary');
      expect(result).toHaveProperty('ghost');
    });
  });

  describe('generateInlineStyles', () => {
    it('should return base styles for a simple component without state', () => {
      const result = generateInlineStyles('card');
      expect(result).toHaveProperty('background', SDUIComponentStyles.card.background);
      expect(result).toHaveProperty('borderRadius', SDUIComponentStyles.card.borderRadius);
      expect(result).toHaveProperty('hover');
    });

    it('should merge state styles with base styles if state is provided', () => {
      const result = generateInlineStyles('card', 'hover');

      expect(result).toHaveProperty('background', SDUIComponentStyles.card.hover.background);
      expect(result).toHaveProperty('borderColor', SDUIComponentStyles.card.hover.borderColor);
      expect(result).toHaveProperty('borderRadius', SDUIComponentStyles.card.borderRadius);
    });

    it('should return base styles unchanged if state is provided but not found in base styles', () => {
      const result = generateInlineStyles('card', 'active');
      expect(result).toHaveProperty('background', SDUIComponentStyles.card.background);
      expect(result).not.toHaveProperty('borderColor');
    });

    it('should return primary button styles if it is a component with variants like button', () => {
      const result = generateInlineStyles('button');
      expect(result).toHaveProperty('background', SDUIComponentStyles.button.primary.background);
      expect(result).toHaveProperty('color', SDUIComponentStyles.button.primary.color);
      expect(result).toHaveProperty('hover');
    });
  });
});
