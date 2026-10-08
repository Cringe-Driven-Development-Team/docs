// Тема по умолчанию; на главной старый якорь индекса схем (#contract) переводит в diagrams/.
// Модули: граф и архив — глобальные компоненты, шапка трека — в слоте doc-before.
import DefaultTheme from 'vitepress/theme';
import { useRoute } from 'vitepress';
import type { Theme } from 'vitepress';
import { h, nextTick, onMounted, watch } from 'vue';
import { diagramsRedirect } from '../site.ts';
import ModuleGraph from './components/ModuleGraph.vue';
import ModuleList from './components/ModuleList.vue';
import TrackMeta from './components/TrackMeta.vue';
import './custom.css';

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
  Layout: () => h(DefaultTheme.Layout, null, { 'doc-before': () => h(TrackMeta) }),
  enhanceApp({ app }) {
    app.component('ModuleGraph', ModuleGraph);
    app.component('ModuleList', ModuleList);
  },
  setup() {
    const route = useRoute();
    onMounted(() => {
      const base = import.meta.env.BASE_URL;
      if (location.pathname === base) {
        const target = diagramsRedirect(location.hash, base);
        if (target) {
          location.replace(target);
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
