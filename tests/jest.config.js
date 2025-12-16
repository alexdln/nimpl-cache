module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>"],
    testMatch: ["**/*.test.ts"],
    moduleFileExtensions: ["ts", "js", "json"],
    transform: {
        "^.+\\.(ts|js)$": "babel-jest",
    },
    moduleNameMapper: {
        "^@nimpl/cache$": "<rootDir>/../packages/cache/src/index.ts",
        "^@nimpl/cache/cache-handler$": "<rootDir>/../packages/cache/src/cache-handler.ts",
        "^@nimpl/cache/src/(.*)$": "<rootDir>/../packages/cache/src/$1",
    },
    setupFilesAfterEnv: ["<rootDir>/setup/jest.setup.ts"],
    collectCoverageFrom: [
        "<rootDir>/../packages/cache/src/**/*.{ts,js}",
        "!<rootDir>/../packages/cache/src/**/*.d.ts",
        "!<rootDir>/../packages/cache/src/index.ts",
    ],
    coverageDirectory: "./coverage",
    coverageReporters: ["text", "lcov", "html"],
    testTimeout: 10000,
};
