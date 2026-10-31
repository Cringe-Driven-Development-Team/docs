// Конфиг сайта документации. Спека: docs/superpowers/specs/2026-10-07-vitepress-csrf-docs-design.md §4.
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { fileURLToPath } from 'node:url';
import { moduleSidebar, readModules } from '@tp-prepare/vitepress-module-graph/node';
import { SITE_BASE } from './site.ts';

// Меню модулей строится из файлов при запуске: новый трек в dev-сервере появится в меню после перезапуска.
const modules = readModules(fileURLToPath(new URL('../modules', import.meta.url)));

export default withMermaid(
  defineConfig({
    lang: 'ru-RU',
    title: 'Cringe Driven Development',
    description: 'Документация команды: архитектура и безопасность сервиса cellestial.ru',
    base: SITE_BASE,
    cleanUrls: true,
    // Логотип cellestial.ru (src/assets/logo-mark.svg фронта). VitePress не добавляет base к ссылкам в head.
    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${SITE_BASE}favicon.svg` }]],
    // Пакет отдаёт .vue как есть: Vite должен собрать его и для SSR.
    vite: { ssr: { noExternal: ['@tp-prepare/vitepress-module-graph'] } },
    markdown: { codeCopyButtonTitle: 'Копировать код' },
    // Сообщения не сжимаются под ширину колонки, длинные переносятся; широкая схема прокручивается.
    mermaid: { securityLevel: 'strict', sequence: { wrap: true, useMaxWidth: false }, flowchart: { useMaxWidth: false } },
    themeConfig: {
      nav: [
        { text: 'OpenWiki', link: '/openwiki/', target: '_self', activeMatch: '^/openwiki/' },
        { text: 'Документация', link: '/documentation/', activeMatch: '^/(documentation/|architecture/|project-context|security/)' },
        { text: 'Модули', link: '/modules/', activeMatch: '^/modules/' },
      ],
      sidebar: {
        '/documentation/': [
          {
            text: 'Документация',
            items: [
              { text: 'Что работает сейчас', link: '/documentation/' },
              { text: 'BFF: проверенная часть', link: '/documentation/bff' },
              { text: 'Архитектура и исторические схемы', link: '/architecture/' },
              { text: 'CSRF: историческая проверка', link: '/security/csrf/' },
              { text: 'Владельцы сведений', link: '/project-context' },
            ],
          },
        ],
        '/project-context': [
          { text: 'Контекст проекта', items: [{ text: 'Источники и правила', link: '/project-context' }] },
        ],
        '/modules/': moduleSidebar(modules),
        '/security/csrf/': [
          {
            text: 'CSRF',
            items: [
              { text: 'Как устроено', link: '/security/csrf/' },
              { text: 'Сценарии', link: '/security/csrf/scenarios' },
              { text: 'Проверка и ограничения', link: '/security/csrf/checks' },
            ],
          },
        ],
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
  }),
);
