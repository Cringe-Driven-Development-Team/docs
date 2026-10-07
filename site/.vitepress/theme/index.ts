// Тема по умолчанию; на главной старый якорь индекса схем (#contract) переводит в diagrams/.
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { onMounted } from 'vue';
import { diagramsRedirect } from '../site.ts';
import './custom.css';

const theme: Theme = {
  extends: DefaultTheme,
  setup() {
    onMounted(() => {
      const base = import.meta.env.BASE_URL;
      if (location.pathname !== base) return;
      const target = diagramsRedirect(location.hash, base);
      if (target) location.replace(target);
    });
  },
};

export default theme;
