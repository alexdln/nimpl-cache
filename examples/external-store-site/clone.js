// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");

const clone = () => {
    fs.cp(".next", ".next-clone", { recursive: true }, (err) => console.error(err));
};

clone();
