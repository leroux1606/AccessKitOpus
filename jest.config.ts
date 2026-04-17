import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
  moduleNameMapper: {
    // Resolve @/ path aliases to src/
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Relax strict checks that don't apply to test code
          strict: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  // What to collect coverage from
  collectCoverageFrom: [
    "src/scanner/scorer.ts",
    "src/scanner/standards-mapper.ts",
    "src/scanner/deduplicator.ts",
    "src/scanner/fix-generator.ts",
    "src/lib/ssrf-guard.ts",
    "src/lib/rate-limiter.ts",
    "src/app/api/health/route.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Silence verbose ts-jest logs in normal runs
  globals: {},
  verbose: true,
};

export default config;
