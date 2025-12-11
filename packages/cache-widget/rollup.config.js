/* eslint-disable @typescript-eslint/no-require-imports */
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const terser = require("@rollup/plugin-terser");
const scss = require("rollup-plugin-scss");
const { default: preserveDirectives } = require("rollup-preserve-directives");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const isProduction = process.env.NODE_ENV === "production";

const createConfig = (format, outputDir, tsconfig) => ({
    input: ["src/index.ts"],
    output: {
        dir: outputDir,
        format,
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: "src",
    },
    external: ["react", "react-dom"],
    plugins: [
        nodeResolve(),
        commonjs(),
        typescript({
            tsconfig: tsconfig,
            declaration: true,
            declarationDir: outputDir,
        }),
        scss({
            outputStyle: isProduction ? "compressed" : "expanded",
            output: true,
            failOnError: true,
            sourceMap: true,
            exclude: ["node_modules/"],
            fileName: "styles.css",
        }),
        isProduction && terser(),
        preserveDirectives(),
    ].filter(Boolean),
});

module.exports = [
    createConfig("es", "dist/esm", "./tsconfig.esm.json"),
    createConfig("cjs", "dist/cjs", "./tsconfig.cjs.json"),
];
