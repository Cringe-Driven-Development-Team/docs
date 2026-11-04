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
import FigmaEmbed from './FigmaEmbed.vue';
import MermaidFrame from './MermaidFrame.vue';
import DiagramSection from './DiagramSection.vue';
import ArticleLoading from './ArticleLoading.vue';
import { prepareArticle } from './article-loading.ts';
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
        'doc-top': () => h(ArticleLoading),
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
    app.component('FigmaEmbed', FigmaEmbed);
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
    const scroll = (initial: boolean, showLoader: boolean) => {
      cancelScroll();
      cancelScroll = prepareArticle({ initial, showLoader });
    };
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
      scroll(true, true);
    });
    watch(
      () => [route.path, route.hash],
      ([path], [previousPath]) => scroll(false, path !== previousPath),
      { flush: 'post' },
    );
  },
};

export default theme;
