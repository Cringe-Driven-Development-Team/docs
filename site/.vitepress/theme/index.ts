// Тема по умолчанию; на главной старый якорь индекса схем (#contract) переводит в diagrams/.
import DefaultTheme from 'vitepress/theme';
import { useRoute } from 'vitepress';
import type { Theme } from 'vitepress';
import { nextTick, onMounted, watch } from 'vue';
import { diagramsRedirect } from '../site.ts';
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
    const navBottom = document.querySelector('.VPNav')?.getBoundingClientRect().bottom ?? 0;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navBottom - 24 });
  };
  tick();
}

const theme: Theme = {
  extends: DefaultTheme,
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
