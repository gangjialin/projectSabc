/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
  coverageThreshold: {
    // 计算引擎是合规核心，要求高覆盖（test_plan §13）
    './src/scoring/': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
};
