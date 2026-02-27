import { readFileSync, writeFileSync } from "node:fs";

const filepath = "dist/gh-actions-tui.js";
const nodeShebang = "#!/usr/bin/env node\n";

let content = readFileSync(filepath, "utf8");
content = content.replace(/^#!.*\n/, "");
writeFileSync(filepath, nodeShebang + content);
