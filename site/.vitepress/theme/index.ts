// Тема по умолчанию; на главной старый якорь индекса схем (#contract) переводит на «Архитектуру».
// Модули: граф, архив и шапка трека — из пакета @tp-prepare/vitepress-module-graph (шапка — в слоте doc-before).
import DefaultTheme from 'vitepress/theme';
import { useRoute } from 'vitepress';
import type { Theme } from 'vitepress';
import { defineComponent, h, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { HIDDEN_FOLDERS, LEGACY_FOLDERS, ROOT_NAMES } from '../diagram-names.ts';
import { diagramTarget } from '../site.ts';
import { installModuleGraph, trackHeader } from '@tp-prepare/vitepress-module-graph/theme';
import '@tp-prepare/vitepress-module-graph/style.css';
import { data } from '../../modules/modules.data.ts';
import Diagram from './Diagram.vue';
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client';
import {
  InjectionKey as ReadabilitiesKey, LayoutMode,
  NolebaseEnhancedReadabilitiesMenu, NolebaseEnhancedReadabilitiesScreenMenu,
  type Options as ReadabilitiesOptions,
} from '@nolebase/vitepress-plugin-enhanced-readabilities/client';
import { defaultRuLocale } from '@nolebase/vitepress-plugin-enhanced-readabilities/locales';
import {
  InjectionKey as PreviewKey, NolebaseInlineLinkPreview, NolebaseInlineLinkPreviewPlugin,
} from '@nolebase/vitepress-plugin-inline-link-preview/client';
import { canPreviewDocLink } from '../link-preview';
import '@nolebase/vitepress-plugin-enhanced-readabilities/client/style.css';
import '@nolebase/vitepress-plugin-inline-link-preview/client/style.css';
import 'virtual:group-icons.css';
import './custom.css';

const readabilities: ReadabilitiesOptions = {
  locales: { 'ru-RU': defaultRuLocale },
  layoutSwitch: { defaultMode: LayoutMode.FullWidth },
  spotlight: { defaultToggle: false },
};

const DocLinkPreview = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const options = inject(PreviewKey, {});
    provide(PreviewKey, {
      ...options,
      previewLocalHostName: false,
      // 2.21.1 passes only the host to this callback; keep the full href in this closure.
      handleShouldPreviewHostNames: () => canPreviewDocLink(String(attrs.href), location.href, import.meta.env.BASE_URL),
    });
    return () => attrs.href == null
      ? h('a', attrs, slots.default?.())
      : h(NolebaseInlineLinkPreview, { ...attrs, href: String(attrs.href) }, slots);
  },
});

const MERMAID_WAIT_MS = 5000;
const MERMAID_SETTLE_MS = 300;

// Браузер прокручивает к якорю до того, как mermaid нарисует схемы; схемы выше якоря потом
// вырастают и уносят раздел вниз. Когда все схемы на странице готовы, прокручиваем ещё раз.
function scrollToHashAfterMermaid(): void {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) return;
  const started = Date.now();
  const tick = () => {
    // Блоки .mermaid плагин создаёт асинхронно: первые MERMAID_SETTLE_MS их может ещё не быть.
    const elapsed = Date.now() - started;
    const blocks = [...document.querySelectorAll('.mermaid')];
    const ready = elapsed >= MERMAID_SETTLE_MS && blocks.every((block) => block.querySelector('svg'));
    if (!ready && elapsed < MERMAID_WAIT_MS) {
      setTimeout(tick, 100);
      return;
    }
    const target = document.getElementById(hash);
    if (!target) return;
    // Как у VitePress: заголовок под шапкой сайта, а не за ней.
    // На узком экране шапка не закреплена и уезжает вверх (bottom < 0), закреплена полоса «Меню».
    const bottomOf = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0;
    const navBottom = Math.max(0, bottomOf('.VPNav'), bottomOf('.VPLocalNav'));
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navBottom - 24 });
  };
  tick();
}

const theme: Theme = {
  extends: DefaultTheme,
  Layout: defineComponent({
    setup() {
      const desktop = ref(true);
      let stop: (() => void) | undefined;
      onMounted(() => {
        const query = matchMedia('(min-width: 768px)');
        const update = () => { desktop.value = query.matches; };
        update();
        query.addEventListener('change', update);
        stop = () => query.removeEventListener('change', update);
      });
      onBeforeUnmount(() => stop?.());
      // 2.21.1 disables desktop controls on mobile; remount restores them without resetting storage.
      return () => h(DefaultTheme.Layout, null, {
        'doc-before': trackHeader,
        'nav-bar-content-after': () => h(NolebaseEnhancedReadabilitiesMenu, { key: desktop.value ? 'desktop' : 'mobile' }),
        'nav-screen-content-after': () => h(NolebaseEnhancedReadabilitiesScreenMenu, { key: desktop.value ? 'desktop' : 'mobile' }),
      });
    },
  }),
  enhanceApp({ app }) {
    installModuleGraph(app, data);
    enhanceAppWithTabs(app);
    app.provide(ReadabilitiesKey, readabilities);
    app.use(NolebaseInlineLinkPreviewPlugin, {
      locales: { 'ru-RU': { popup: {
        loading: 'Загрузка…', loadingAriaLabel: 'Загрузка предпросмотра',
        openInCurrentPage: 'Открыть страницу', openInCurrentPageAriaLabel: 'Открыть страницу',
        iframeAriaLabel: 'Предпросмотр страницы',
      } } },
    });
    app.component('DocLinkPreview', DocLinkPreview);
    app.component('Diagram', Diagram);
  },
  setup() {
    const route = useRoute();
    onMounted(() => {
      const base = import.meta.env.BASE_URL;
      if (location.pathname === base) {
        const target = diagramTarget(location.hash, ROOT_NAMES, [...HIDDEN_FOLDERS, ...LEGACY_FOLDERS]);
        if (target) {
          location.replace(base + target);
          return;
        }
      }
      scrollToHashAfterMermaid();
    });
    watch(
      () => route.path,
      () => nextTick(scrollToHashAfterMermaid),
    );
  },
};

export default theme;
