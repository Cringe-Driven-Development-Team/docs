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

test('front-libs separates the work order, archive checks and recovery', async () => {
  const root = 'site/modules/2/tracks/front-libs';
  const overview = await Bun.file(`${root}.md`).text();
  expect(overview).toContain('## Как работать с треком');
  expect(overview).toContain('pages: [publishing, releases, compatibility, setup, recovery]');
  const compatibility = await Bun.file(`${root}/compatibility.md`).text();
  expect(compatibility).toContain('## Проверка архивов в чистом проекте');
  for (const needle of ['optional peer', './vanilla', 'оба локальных архива', 'Release PR'])
    expect(compatibility, needle).toContain(needle);
  const recovery = await Bun.file(`${root}/recovery.md`).text();
  expect(recovery).toContain('## Если публикация завершилась частично');
  for (const needle of ['1.2.1', '1.0.1', 'не перезаписываем', 'того же проверенного релизного коммита'])
    expect(recovery, needle).toContain(needle);
});

test('npm comparison keeps date-pinned permissions distinct from package quality', async () => {
  const source = await Bun.file('site/modules/2/tracks/front-libs/publishing.md').text();
  const [before, token, oidc] = source.split(/== npm-токен\n|== Trusted Publishing \(рекомендуется\)\n/);
  expect(token).toContain('repository variable');
  expect(before + oidc!).not.toContain('variable');
  for (const needle of ['2026-10-17', 'granular tokens', 'classic/automation tokens', 'Read and write',
    'Bypass 2FA', 'stage-only', '2027', 'за два дня', 'pull-requests: write', 'contents: write',
    '22.14.0', '11.5.1', 'качество архива']) expect(source, needle).toContain(needle);
});
