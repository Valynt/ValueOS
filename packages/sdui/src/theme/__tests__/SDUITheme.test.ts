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
      // Ensure hover is still present since generateInlineStyles returns the baseStyles object directly when no state matches
      expect(result).toHaveProperty('hover');
    });

    it('should merge state styles with base styles if state is provided', () => {
      const result = generateInlineStyles('card', 'hover');

      // Should have merged background from hover state
      expect(result).toHaveProperty('background', SDUIComponentStyles.card.hover.background);
      // Should have merged borderColor from hover state
      expect(result).toHaveProperty('borderColor', SDUIComponentStyles.card.hover.borderColor);
      // Should retain base styles not overridden by hover
      expect(result).toHaveProperty('borderRadius', SDUIComponentStyles.card.borderRadius);
    });

    it('should return base styles unchanged if state is provided but not found in base styles', () => {
      // e.g. 'active' state for card (card only has 'hover')
      const result = generateInlineStyles('card', 'active');
      expect(result).toHaveProperty('background', SDUIComponentStyles.card.background);
      // Should not contain unexpected properties
      expect(result).not.toHaveProperty('borderColor');
    });

    it('should return primary button styles if it is a component with variants like button', () => {
      const result = generateInlineStyles('button');
      // Should return the primary variant directly
      expect(result).toHaveProperty('background', SDUIComponentStyles.button.primary.background);
      expect(result).toHaveProperty('color', SDUIComponentStyles.button.primary.color);
      // It includes hover inside the primary variant
      expect(result).toHaveProperty('hover');
    });

    it('should ignore state and return primary button styles for component with variants', () => {
      // Currently, generateInlineStyles returns primary early without considering the state argument
      const result = generateInlineStyles('button', 'hover');
      expect(result).toHaveProperty('background', SDUIComponentStyles.button.primary.background);

      // Since state merging isn't reached, the base properties are returned (which includes hover object but isn't merged)
      expect(result).toHaveProperty('hover');
    });
  });
});
