import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadWorkflowNameModule() {
  const source = fs.readFileSync(
    path.join(rootDir, "lib", "workflow-name.ts"),
    "utf8"
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };

  vm.runInNewContext(
    outputText,
    {
      exports: module.exports,
      module,
      require: (id) => {
        throw new Error(`Unexpected runtime import in workflow name test: ${id}`);
      },
    },
    { filename: "workflow-name.ts" }
  );

  return module.exports;
}

const { generateWorkflowName } = loadWorkflowNameModule();

test("generates neutral adjective noun number workflow names", () => {
  const values = [0, 0, 0];
  const name = generateWorkflowName(() => values.shift() ?? 0);

  assert.equal(name, "Amber Atlas 100");
  assert.match(name, /^[A-Z][a-z]+ [A-Z][a-z]+ \d{3}$/);
  assert.doesNotMatch(name.toLowerCase(), /diligence|invest|memo|ic/);
});
