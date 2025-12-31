module.exports = {
  extends: ["stylelint-config-standard"],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "variants",
          "responsive",
          "screen",
          "layer",
        ],
      },
    ],
    "color-no-hex": null,
    "unit-disallowed-list": null,
    "declaration-no-important": null,
    "selector-class-pattern": null,
    "keyframes-name-pattern": null,
    "property-no-deprecated": null,
    "declaration-property-value-keyword-no-deprecated": null,
    "media-feature-name-value-no-unknown": null,
  },
};
