import { expect, test } from 'bun:test';
import { canPreviewDocLink } from '../site/.vitepress/link-preview';

for (const base of ['/', '/branches/readability/']) {
  test(`preview permits text pages within ${base}`, () => {
    const current = `https://docs.cellestial.ru${base}modules/2/tracks/offline/theory`;
    for (const href of ['./architecture', './architecture#что-кешируем',
      `${base}documentation/bff`, `${base}project-context`, `${base}security/csrf/`]) {
      expect(canPreviewDocLink(href, current, base), href).toBe(true);
    }
    for (const href of ['#service-worker', current + '#service-worker',
      `${base}modules/`, `${base}modules/2/`, `${base}architecture/`, `${base}openwiki/`,
      `${base}openwiki/page`, `${base}deployment.html`, `${base}diagram.png`, `${base}diagram.svg`,
      `${base}data.json`, `${base}download.zip`, 'https://github.com/a/b',
      'mailto:test@example.invalid', 'javascript:void(0)', 'http://[']) {
      expect(canPreviewDocLink(href, current, base), href).toBe(false);
    }
    expect(canPreviewDocLink(current + '.html', current, base)).toBe(false);
    expect(canPreviewDocLink(current + '/', current, base)).toBe(false);
    expect(canPreviewDocLink('./architecture', 'http://[', base)).toBe(false);
  });
}

test('branch previews do not cross the current base', () => {
  const current = 'https://docs.cellestial.ru/branches/readability/modules/2/tracks/offline/theory';
  for (const href of ['/modules/2/tracks/offline/architecture',
    '/branches/other/modules/2/tracks/offline/architecture']) {
    expect(canPreviewDocLink(href, current, '/branches/readability/'), href).toBe(false);
  }
});

test('publishing keeps public anchors and common limitations outside its alternatives', async () => {
  const source = await Bun.file('site/modules/2/tracks/front-libs/publishing.md').text();
  const [before, tabs, after] = source.split(/::: tabs\n|\n:::\n/);
  expect(before).toContain('id="публикация-с-npm-токеном"');
  expect(before).toContain('id="trusted-publishing-через-oidc"');
  expect(tabs).toContain('== npm-токен');
  expect(tabs).toContain('== Trusted Publishing (рекомендуется)');
  expect(after).toContain('### Сравнение');
  expect(after).toContain('Уточнение на 2026-10-17:');
  expect(after).toContain('Новую конфигурацию надо подтвердить первым успешным выпуском за два дня');
});
