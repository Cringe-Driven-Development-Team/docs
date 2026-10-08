// Структура workflow: GitHub отвергает весь файл, если у шага нет ни `run`, ни `uses`.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

type Step = Record<string, unknown>;
type Workflow = { jobs: Record<string, { steps?: Step[] }> };

const DIR = ".github/workflows";
const load = (file: string) => Bun.YAML.parse(readFileSync(`${DIR}/${file}`, "utf8")) as Workflow;

describe("workflows", () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".yml"))) {
    test(`${file}: у каждого шага есть run или uses`, () => {
      for (const [name, job] of Object.entries(load(file).jobs)) {
        for (const [i, step] of (job.steps ?? []).entries()) {
          expect(`${name}[${i}] ${"run" in step || "uses" in step}`).toBe(`${name}[${i}] true`);
        }
      }
    });
  }

  test("pages.yml: загрузка снимка в job board идёт после сбоя sync", () => {
    const steps = load("pages.yml").jobs.board?.steps ?? [];
    const upload = steps.find((s) => String(s.uses).startsWith("actions/upload-artifact"));
    expect(upload?.if).toBe("!cancelled()");
  });
});
