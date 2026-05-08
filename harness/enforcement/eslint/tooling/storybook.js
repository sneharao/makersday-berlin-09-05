// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

// `flat/recommended` is an array of 3 config objects (plugins + two rule
// blocks scoped to story/config file globs). Export the array directly so
// the composer can spread it uniformly with the other modules.

export default storybook.configs["flat/recommended"];
