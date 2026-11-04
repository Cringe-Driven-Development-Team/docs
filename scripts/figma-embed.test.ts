import { expect, test } from 'bun:test';
import { figmaUrls } from '../site/.vitepress/figma-embed';

const design = 'https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/Cellestial';

test('Figma: сохраняет экран и убирает Dev Mode и лишние параметры', () => {
  expect(figmaUrls(`${design}?node-id=496-16027&m=dev&mode=dev&p=f#ignored`)).toEqual({
    source: 'https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/Cellestial?node-id=496-16027',
    embed: 'https://embed.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq/Cellestial?node-id=496-16027&embed-host=docs.cellestial.ru',
  });
});

test('Figma: принимает ссылку без имени файла и нормализует node-id', () => {
  expect(figmaUrls('https://figma.com/design/7iaVDGiwzQk2vZIB5ogVlq?node-id=496%3A16027')).toEqual({
    source: 'https://www.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq?node-id=496-16027',
    embed: 'https://embed.figma.com/design/7iaVDGiwzQk2vZIB5ogVlq?node-id=496-16027&embed-host=docs.cellestial.ru',
  });
});

test.each([
  '', 'not a url', 'javascript:alert(1)',
  `${design.replace('https:', 'http:')}?node-id=496-16027`,
  `${design.replace('www.figma.com', 'example.org')}?node-id=496-16027`,
  `${design.replace('www.figma.com', 'www.figma.com.example.org')}?node-id=496-16027`,
  `${design.replace('www.figma.com', 'user:password@www.figma.com')}?node-id=496-16027`,
  `${design.replace('www.figma.com', 'www.figma.com:8443')}?node-id=496-16027`,
  `${design.replace('/design/', '/proto/')}?node-id=496-16027`,
  'https://www.figma.com/design/?node-id=496-16027',
  `${design}/extra?node-id=496-16027`,
  design, `${design}?node-id=`, `${design}?node-id=bad`,
  `${design}?node-id=-496-16027`, `${design}?node-id=496-16027-other`,
  `${design}?node-id=496-16027&node-id=496-16027`,
])('Figma: отклоняет неподдержанную ссылку %s', input => {
  expect(() => figmaUrls(input)).toThrow(/Figma/);
});
