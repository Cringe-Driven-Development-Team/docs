// Конфиг сайта документации. Спека: docs/superpowers/specs/2026-10-07-vitepress-csrf-docs-design.md §4.
import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { moduleSidebar, readModules } from '@wely6743/vitepress-module-graph/node';
import { SITE_BASE } from './site.ts';
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs';
import { mermaidFence } from '@wely6743/vitepress-diagram-viewer/node';
import { articleLoadingHeadScript } from './theme/article-loading.ts';
import { readingLayoutHeadScript } from './theme/reading-layout.ts';
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons';

// Меню модулей строится из файлов при запуске: новый трек в dev-сервере появится в меню после перезапуска.
const modules = readModules(fileURLToPath(new URL('../modules', import.meta.url)));
const documentationSidebar = [
  {
    text: 'Документация',
    items: [
      { text: 'Обзор продукта', link: '/documentation/' },
      { text: 'Что работает сейчас', link: '/documentation/current-state' },
      { text: 'Frontend', link: '/documentation/frontend/', collapsed: true, items: [
        { text: 'Архитектура', link: '/documentation/frontend/architecture' },
        { text: 'Роутинг', link: '/documentation/frontend/routing' },
        { text: 'Сборка и разработка', link: '/documentation/frontend/build' },
        { text: 'Стили', link: '/documentation/frontend/styles' },
        { text: 'Запуск приложения', link: '/documentation/frontend/startup' },
        { text: 'Компоненты и рендеринг', link: '/documentation/frontend/rendering' },
        { text: 'Управление состоянием', link: '/documentation/frontend/state' },
        { text: 'Запросы и ошибки', link: '/documentation/frontend/requests' },
        { text: 'Сессия и авторизация', link: '/documentation/frontend/session' },
        { text: 'BFF', link: '/documentation/frontend/bff' },
        { text: 'Командные пакеты', link: '/documentation/frontend/packages' },
        { text: 'Проверка изменений', link: '/documentation/frontend/checks' },
        { text: 'Выкатки', link: '/documentation/frontend/releases/', collapsed: true, items: [
          { text: 'CI и публикация', link: '/documentation/frontend/releases/publication' },
          { text: 'Состав выпуска', link: '/documentation/frontend/releases/artifacts' },
          { text: 'Выкатка', link: '/documentation/frontend/releases/deployment' },
          { text: 'Откат', link: '/documentation/frontend/releases/rollback' },
          { text: 'Ошибки и уведомления', link: '/documentation/frontend/releases/troubleshooting' },
        ]},
      ] },
      { text: 'Офлайн-режим', link: '/documentation/offline/', collapsed: true, items: [
        { text: 'Сборка и регистрация SW', link: '/documentation/offline/build-and-registration' },
        { text: 'Инфраструктура PWA', link: '/documentation/offline/infrastructure' },
      ] },
      { text: 'Блокноты: реализация', link: '/documentation/notebooks/', collapsed: true, items: [
        { text: 'Редактирование и сохранение', link: '/documentation/notebooks/editing' },
        {text: 'Окружение и исполнение', link: '/documentation/notebooks/execution'},
        {text: 'Результаты', link: '/documentation/notebooks/results'},
        {text: 'Хранение и инфраструктура', link: '/documentation/notebooks/storage-and-infrastructure'},
      ] },
      { text: 'Архитектура', link: '/documentation/architecture/' },
      { text: 'Безопасность', link: '/documentation/security/', collapsed: true, items: [
        { text: 'CSRF', link: '/documentation/security/csrf' },
        { text: 'XSS', link: '/documentation/security/xss' },
        { text: 'CSP', link: '/documentation/security/csp' },
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
      ['meta', { name: 'robots', content: 'noindex' }],
      ['link', { rel: 'icon', type: 'image/svg+xml', href: `${SITE_BASE}favicon.svg` }],
      ['script', { id: 'reading-layout' }, readingLayoutHeadScript()],
      ['script', {}, articleLoadingHeadScript()],
    ],
    // Пакет отдаёт .vue как есть: Vite должен собрать его и для SSR.
    vite: {
      plugins: [groupIconVitePlugin()],
      ssr: { noExternal: ['@wely6743/vitepress-module-graph', '@wely6743/vitepress-diagram-viewer', /^@nolebase\//] },
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
