import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const sections = {
  index: { diagrams: ['journey', 'states'], titles: ['Что видит пользователь', 'Кто меняет статус', 'Что требуется по заданию', 'Куда дальше'] },
  architecture: { diagrams: ['services', 'polling', 'upload', 'download'], titles: ['От виджета до хранилища', 'Как приходит ответ без WebSocket', 'Как приложить фото или лог', 'Как собеседник открывает вложение'] },
  demo: { diagrams: ['handoffs'], titles: ['Где встречаются задачи', 'Как пройти демо и проверить цифры'] },
};

for (const [page, section] of Object.entries(sections)) {
  test(`hackathon/${page} has the teaching sequence and paired diagrams`, () => {
    const md = readFileSync(`site/documentation/hackathon/${page}.md`, 'utf8');
    expect([...md.matchAll(/^## (.+)$/gm)].map(match => match[1])).toEqual(section.titles);
    const diagrams = [...md.matchAll(/<DiagramSection>([\s\S]*?)<\/DiagramSection>/g)];
    const names = diagrams.map(match => match[1]?.match(/<Diagram name="hackathon\/([a-z-]+)" \/>/)?.[1]);
    expect(names).toEqual(section.diagrams);
    expect(md).not.toContain('```mermaid');
    for (const name of section.diagrams) expect(Bun.file(`diagrams/hackathon/${name}.json`).size).toBeGreaterThan(0);
    expect(md).not.toMatch(/\{\{|\b(?:\d{1,3}\.){3}\d{1,3}\b|BEGIN \w+ PRIVATE KEY/);
    if (page === 'demo') expect(new Set(md.match(/github\.com\/Cringe-Driven-Development-Team\/\w+\/issues\/\d+/g)).size).toBe(11);
  });
}
