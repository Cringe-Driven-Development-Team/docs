import { expect, test } from 'bun:test';
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
