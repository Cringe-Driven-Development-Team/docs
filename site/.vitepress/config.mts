// Конфиг сайта документации. Спека: docs/superpowers/specs/2026-10-07-vitepress-csrf-docs-design.md §4.
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { SITE_BASE } from './site.ts';

export default withMermaid(
  defineConfig({
    lang: 'ru-RU',
    title: 'Cringe Driven Development',
    description: 'Документация команды: архитектура и безопасность сервиса cellestial.ru',
    base: SITE_BASE,
    cleanUrls: true,
    markdown: { codeCopyButtonTitle: 'Копировать код' },
    // Сообщения не сжимаются под ширину колонки, длинные переносятся; широкая схема прокручивается.
    mermaid: { securityLevel: 'strict', sequence: { wrap: true, useMaxWidth: false } },
    themeConfig: {
      nav: [
        // Индекс схем — не страница VitePress: target не даёт роутеру перехватить переход.
        { text: 'Архитектура', link: '/diagrams/', target: '_self' },
        { text: 'Безопасность', link: '/security/csrf/', activeMatch: '^/security/' },
      ],
      sidebar: {
        '/security/csrf/': [
          {
            text: 'CSRF',
            items: [
              { text: 'Как устроено', link: '/security/csrf/' },
              { text: 'Сценарии', link: '/security/csrf/scenarios' },
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
