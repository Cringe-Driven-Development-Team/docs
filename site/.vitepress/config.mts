// Конфиг сайта документации. Спека: docs/superpowers/specs/2026-10-07-vitepress-csrf-docs-design.md §4.
import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { moduleSidebar, readModules } from '@tp-prepare/vitepress-module-graph/node';
import { SITE_BASE } from './site.ts';
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs';
import { mermaidFence } from './mermaid-fence.ts';
import { articleLoadingHeadScript } from './theme/article-loading.ts';
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons';

// Меню модулей строится из файлов при запуске: новый трек в dev-сервере появится в меню после перезапуска.
const modules = readModules(fileURLToPath(new URL('../modules', import.meta.url)));
const documentationSidebar = [
  {
    text: 'Документация',
    items: [
      { text: 'Что работает сейчас', link: '/documentation/' },
      { text: 'BFF: проверенная часть', link: '/documentation/bff' },
      { text: 'Офлайн-режим', link: '/documentation/offline/', collapsed: true, items: [
        { text: 'Сборка и регистрация SW', link: '/documentation/offline/build-and-registration' },
      ] },
      { text: 'Архитектура', link: '/documentation/architecture/' },
      { text: 'CSRF: историческая проверка', link: '/documentation/csrf/', collapsed: true, items: [
        { text: 'Сценарии', link: '/documentation/csrf/scenarios' },
        { text: 'Проверка и ограничения', link: '/documentation/csrf/checks' },
      ] },
      { text: 'Владельцы сведений', link: '/documentation/project-context' },
    ],
  },
];

export default defineConfig({
    lang: 'ru-RU',
    title: 'Cringe Driven Development',
    description: 'Документация команды: архитектура и безопасность сервиса cellestial.ru',
    base: SITE_BASE,
    cleanUrls: true,
    // Логотип cellestial.ru (src/assets/logo-mark.svg фронта). VitePress не добавляет base к ссылкам в head.
    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: `${SITE_BASE}favicon.svg` }],
      ['script', {}, articleLoadingHeadScript()],
    ],
    // Пакет отдаёт .vue как есть: Vite должен собрать его и для SSR.
    vite: {
      plugins: [groupIconVitePlugin()],
      ssr: { noExternal: ['@tp-prepare/vitepress-module-graph', /^@nolebase\//] },
      // CommonJS-хелперы нужны до гидратации темы.
      optimizeDeps: {
        include: ['fastdom', 'fastdom/extensions/fastdom-promised.js'],
        exclude: [
          '@nolebase/vitepress-plugin-enhanced-readabilities/client',
        ],
      },
    },
    markdown: {
      codeCopyButton: { tooltipText: 'Копировать код' },
      config(md) {
        md.use(tabsMarkdownPlugin);
        md.use(groupIconMdPlugin);
        md.use(mermaidFence);
      },
    },
    themeConfig: {
      nav: [
        { text: 'OpenWiki', link: '/openwiki/', target: '_self', activeMatch: '^/openwiki/' },
        { text: 'Документация', link: '/documentation/', activeMatch: '^/documentation/' },
        { text: 'Модули', link: '/modules/', activeMatch: '^/modules/' },
      ],
      sidebar: {
        '/documentation/': documentationSidebar,
        '/modules/': moduleSidebar(modules),
      },
      socialLinks: [{ icon: 'github', link: 'https://github.com/Cringe-Driven-Development-Team/docs' }],
      outline: { level: [2, 3], label: 'На этой странице' },
      docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' },
      skipToContentLabel: 'Перейти к содержимому',
      sidebarMenuLabel: 'Меню',
      returnToTopLabel: 'Наверх',
      darkModeSwitchLabel: 'Оформление',
      lightModeSwitchTitle: 'Светлая тема',
      darkModeSwitchTitle: 'Тёмная тема',
      langMenuLabel: 'Язык',
      notFound: {
        title: 'Страница не найдена',
        quote: 'Такой страницы нет — возможно, её переименовали.',
        linkLabel: 'Перейти на главную',
        linkText: 'На главную',
      },
      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: 'Поиск', buttonAriaLabel: 'Найти в документации' },
            modal: {
              displayDetails: 'Показать подробности',
              resetButtonTitle: 'Сбросить',
              backButtonTitle: 'Закрыть поиск',
              noResultsText: 'Ничего не найдено по запросу',
              footer: {
                selectText: 'выбрать',
                selectKeyAriaLabel: 'Enter',
                navigateText: 'перейти',
                navigateUpKeyAriaLabel: 'Стрелка вверх',
                navigateDownKeyAriaLabel: 'Стрелка вниз',
                closeText: 'закрыть',
                closeKeyAriaLabel: 'Escape',
              },
            },
          },
        },
      },
    },
});
