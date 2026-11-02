// Тема по умолчанию; на главной старый якорь индекса схем (#contract) переводит на «Архитектуру».
// Модули: граф, архив и шапка трека — из пакета @tp-prepare/vitepress-module-graph (шапка — в слоте doc-before).
import DefaultTheme from 'vitepress/theme';
import { useData, useRoute } from 'vitepress';
import { createMermaidRenderer } from 'vitepress-mermaid-renderer';
import 'vitepress-mermaid-renderer/css';
import type { Theme } from 'vitepress';
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { HIDDEN_FOLDERS, LEGACY_FOLDERS, ROOT_NAMES } from '../diagram-names.ts';
import { diagramTarget } from '../site.ts';
import { installModuleGraph, trackHeader } from '@tp-prepare/vitepress-module-graph/theme';
import '@tp-prepare/vitepress-module-graph/style.css';
import { data } from '../../modules/modules.data.ts';
import Diagram from './Diagram.vue';
import MermaidFrame from './MermaidFrame.vue';
import DiagramSection from './DiagramSection.vue';
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client';
import {
  InjectionKey as ReadabilitiesKey, LayoutMode,
  NolebaseEnhancedReadabilitiesMenu, NolebaseEnhancedReadabilitiesScreenMenu,
  type Options as ReadabilitiesOptions,
} from '@nolebase/vitepress-plugin-enhanced-readabilities/client';
import { defaultRuLocale } from '@nolebase/vitepress-plugin-enhanced-readabilities/locales';
import '@nolebase/vitepress-plugin-enhanced-readabilities/client/style.css';
import 'virtual:group-icons.css';
import './custom.css';

const readabilities: ReadabilitiesOptions = {
  locales: { 'ru-RU': defaultRuLocale },
  layoutSwitch: {
    defaultMode: LayoutMode.FullWidth,
    disableAnimation: true,
    pageLayoutMaxWidth: { disableAnimation: true },
    contentLayoutMaxWidth: { disableAnimation: true },
  },
  spotlight: { defaultToggle: false },
};

const MERMAID_WAIT_MS = 5000;
const MERMAID_SETTLE_MS = 300;

// Браузер прокручивает к якорю до того, как mermaid нарисует схемы; схемы выше якоря потом
// вырастают и уносят раздел вниз. Когда все схемы на странице готовы, прокручиваем ещё раз.
function scrollToHashAfterMermaid(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    clearTimeout(timer);
    for (const event of ['wheel', 'touchstart', 'keydown']) window.removeEventListener(event, cancel);
  };
  const href = location.href;
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) return cancel;
  const started = Date.now();
  for (const event of ['wheel', 'touchstart', 'keydown']) window.addEventListener(event, cancel, { passive: true });
  const tick = () => {
    if (location.href !== href) { cancel(); return; }
    // Блоки .mermaid плагин создаёт асинхронно: первые MERMAID_SETTLE_MS их может ещё не быть.
    const elapsed = Date.now() - started;
    const blocks = [...document.querySelectorAll('.mermaid')];
    // Nolebase 2.21.1 applies saved slider widths after a debounce, also across 1440px.
    // Match its clamped value, not just an old nonempty inline style from the previous viewport.
    const adjustable = document.body.matches('.VPNolebaseEnhancedReadabilitiesLayoutSwitchSidebarWidthAdjustableOnly,.VPNolebaseEnhancedReadabilitiesLayoutSwitchBothWidthAdjustable');
    const widthsReady = !adjustable || (['page', 'content'] as const).every(kind => {
      const saved = parseInt(localStorage.getItem(`vitepress-nolebase-enhanced-readabilities-${kind}-layout-max-width`) ?? String(kind === 'page' ? 10000 : 8000));
      const percent = matchMedia('(min-width: 1440px)').matches
        ? Math.ceil((Number.isNaN(saved) ? 10000 : Math.min(10000, Math.max(6000, saved))) / 100)
        : 100;
      return document.body.style.getPropertyValue(`--vp-nolebase-enhanced-readabilities-${kind}-max-width`) === `${percent}%`;
    });
    const ready = elapsed >= MERMAID_SETTLE_MS && widthsReady && blocks.every((block) => block.querySelector('svg'));
    if (!ready && elapsed < MERMAID_WAIT_MS) {
      timer = setTimeout(tick, 100);
      return;
    }
    cancel();
    const target = document.getElementById(hash);
    if (!target) return;
    // Как у VitePress: заголовок под шапкой сайта, а не за ней.
    // На узком экране шапка не закреплена и уезжает вверх (bottom < 0), закреплена полоса «Меню».
    const bottomOf = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0;
    const navBottom = Math.max(0, bottomOf('.VPNav'), bottomOf('.VPLocalNav'));
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navBottom - 24 });
  };
  tick();
  return cancel;
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
    app.component('Diagram', Diagram);
    app.component('MermaidFrame', MermaidFrame);
    app.component('DiagramSection', DiagramSection);
  },
  setup() {
    const route = useRoute();
    const { isDark } = useData();
    onMounted(() => {
      createMermaidRenderer({
        static: true, startOnLoad: false, securityLevel: 'strict',
        theme: isDark.value ? 'dark' : 'default',
        sequence: { wrap: true, useMaxWidth: false }, flowchart: { useMaxWidth: false },
      });
    });
    watch(isDark, dark => createMermaidRenderer({ theme: dark ? 'dark' : 'default' }));
    let cancelScroll = () => {};
    const scroll = () => { cancelScroll(); cancelScroll = scrollToHashAfterMermaid(); };
    onBeforeUnmount(() => cancelScroll());
    onMounted(() => {
      const base = import.meta.env.BASE_URL;
      if (location.pathname === base) {
        const target = diagramTarget(location.hash, ROOT_NAMES, [...HIDDEN_FOLDERS, ...LEGACY_FOLDERS]);
        if (target) {
          location.replace(base + target);
          return;
        }
      }
      scroll();
    });
    watch(
      () => [route.path, route.hash],
      scroll,
      { flush: 'post' },
    );
  },
};

export default theme;
