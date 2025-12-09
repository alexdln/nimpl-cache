module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>"],
    testMatch: ["**/*.test.ts"],
    moduleFileExtensions: ["ts", "js", "json"],
    transform: {
        "^.+\\.(ts|js)$": "babel-jest",
    },
    moduleNameMapper: {
        "^@nimpl/cache-redis$": "<rootDir>/../packages/cache-redis/src/index.ts",
        "^@nimpl/cache-redis/cache-handler$": "<rootDir>/../packages/cache-redis/src/cache-handler.ts",
        "^@nimpl/cache-redis/src/(.*)$": "<rootDir>/../packages/cache-redis/src/$1",
    },
    setupFilesAfterEnv: ["<rootDir>/setup/jest.setup.ts"],
    collectCoverageFrom: [
        "<rootDir>/../packages/cache-redis/src/**/*.{ts,js}",
        "!<rootDir>/../packages/cache-redis/src/**/*.d.ts",
        "!<rootDir>/../packages/cache-redis/src/index.ts",
    ],
    coverageDirectory: "./coverage",
    coverageReporters: ["text", "lcov", "html"],
    testTimeout: 10000,
};
