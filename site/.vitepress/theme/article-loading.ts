/// <reference lib="dom" />

type LoadingState = { deadline: number; finished: boolean; done: Promise<boolean>; finish: (interrupted?: boolean) => void };
declare global { interface Window { __docsArticleLoading?: LoadingState } }

// Serialized into head: keep this function independent of module bindings and Vue.
function beginLoading(timeout: number): LoadingState {
  window.__docsArticleLoading?.finish(true);
  const root = document.documentElement;
  const events = ['wheel', 'touchstart', 'keydown'];
  let resolveDone!: (automatic: boolean) => void;
  const done = new Promise<boolean>(resolve => { resolveDone = resolve; });
  const state: LoadingState = { deadline: performance.now() + timeout, finished: false, done, finish };
  const input = () => finish(true);
  const timer = window.setTimeout(finish, timeout);
  function markBusy(): void {
    const article = document.querySelector('.VPDoc');
    if (article?.querySelector('[data-diagram-kind="mermaid"]')) {
      article.setAttribute('aria-busy', 'true');
      article.querySelector(':scope > .container')?.setAttribute('inert', '');
    }
  }
  function finish(interrupted = false): void {
    if (state.finished) return;
    state.finished = true;
    clearTimeout(timer);
    for (const event of events) window.removeEventListener(event, input);
    document.removeEventListener('DOMContentLoaded', markBusy);
    if (window.__docsArticleLoading === state) {
      root.removeAttribute('data-article-loading');
      document.querySelector('.VPDoc')?.removeAttribute('aria-busy');
      document.querySelector('.VPDoc > .container')?.removeAttribute('inert');
    }
    resolveDone(!interrupted);
  }
  window.__docsArticleLoading = state;
  root.setAttribute('data-article-loading', 'pending');
  for (const event of events) window.addEventListener(event, input, { passive: true });
  document.addEventListener('DOMContentLoaded', markBusy, { once: true });
  markBusy();
  return state;
}

export function articleLoadingHeadScript(): string {
  return `(${beginLoading.toString()})(5000);`;
}

function widthsReady(): boolean {
  const adjustable = document.body.matches('.VPNolebaseEnhancedReadabilitiesLayoutSwitchSidebarWidthAdjustableOnly,.VPNolebaseEnhancedReadabilitiesLayoutSwitchBothWidthAdjustable');
  return !adjustable || (['page', 'content'] as const).every(kind => {
    const saved = parseInt(localStorage.getItem(`vitepress-nolebase-enhanced-readabilities-${kind}-layout-max-width`) ?? String(kind === 'page' ? 10000 : 8000));
    const percent = matchMedia('(min-width: 1440px)').matches
      ? Math.ceil((Number.isNaN(saved) ? 10000 : Math.min(10000, Math.max(6000, saved))) / 100) : 100;
    return document.body.style.getPropertyValue(`--vp-nolebase-enhanced-readabilities-${kind}-max-width`) === `${percent}%`;
  });
}

export function prepareArticle({ initial, showLoader }: { initial: boolean; showLoader: boolean }): () => void {
  const article = document.querySelector('.VPDoc');
  const hasDiagrams = !!article?.querySelector('[data-diagram-kind="mermaid"]');
  const state = showLoader && hasDiagrams ? (initial ? window.__docsArticleLoading : beginLoading(5000)) : undefined;
  if (initial && !hasDiagrams) window.__docsArticleLoading?.finish();
  // A late application must not hide or reposition text the watchdog already revealed.
  if (state?.finished) return () => {};
  let hash = '';
  try { hash = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid fragments have no target. */ }
  if (!hasDiagrams && !hash) return () => {};
  const href = location.href;
  const deadline = state?.deadline ?? performance.now() + 5000;
  let animation = 0;
  let stopped = false;
  let previous: number[] | undefined;
  let stable = 0;
  const input = () => cancel();
  function cancel(): void {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(animation);
    for (const event of ['wheel', 'touchstart', 'keydown']) window.removeEventListener(event, input);
    state?.finish(true);
  }
  function reveal(): void { state?.finish(); cancel(); }
  const focusOwner = document.querySelector('.VPSkipLink')?.previousElementSibling;
  if (state) void state.done.then(automatic => {
    cancel();
    if (!automatic || initial || !hash || history.state?.scrollPosition || window.__docsArticleLoading !== state || location.href !== href || document.activeElement !== focusOwner) return;
    const target = document.getElementById(hash);
    if (!target) return;
    // Retry the router's heading focus only while navigation still owns it.
    const temporary = !target.hasAttribute('tabindex');
    if (temporary) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (temporary) {
      if (document.activeElement === target) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      else target.removeAttribute('tabindex');
    }
  });
  for (const event of ['wheel', 'touchstart', 'keydown']) window.addEventListener(event, input, { passive: true });
  if (state) {
    article?.setAttribute('aria-busy', 'true');
    // SVG styles can override inherited visibility; inert also hides them from focus and AT.
    article?.querySelector(':scope > .container')?.setAttribute('inert', '');
  }
  function tick(): void {
    if (stopped || location.href !== href || !article?.isConnected || state?.finished) { cancel(); return; }
    if (performance.now() >= deadline) { reveal(); return; }
    const target = hash ? document.getElementById(hash) : null;
    if (target) {
      const bottom = (s: string) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0;
      const top = target.getBoundingClientRect().top + scrollY - Math.max(0, bottom('.VPNav'), bottom('.VPLocalNav')) - 24;
      if (Math.abs(scrollY - top) > 1) window.scrollTo({ top, behavior: 'instant' });
    }
    const candidates: HTMLElement[] = [];
    for (const card of article.querySelectorAll<HTMLElement>('figure[data-diagram-kind="mermaid"]')) {
      const box = card.getBoundingClientRect();
      if (box.bottom >= -200 && box.top <= innerHeight + 200 || card.querySelector('.mermaid-rendering')) candidates.push(card);
    }
    if ([...candidates].some(card => card.querySelector('.diagram-error'))) { reveal(); return; }
    const ready = document.fonts.status === 'loaded' && widthsReady() && [...candidates].every(card => {
      const canvas = card.querySelector<HTMLElement>('.diagram__canvas');
      const svg = card.querySelector('svg');
      return svg && canvas?.style.transform && !card.querySelector('.mermaid-rendering');
    });
    const geometry = [document.documentElement.scrollHeight, article.clientWidth, scrollY, target?.getBoundingClientRect().top ?? 0,
      ...[...candidates].flatMap(card => { const box = card.getBoundingClientRect(); return [box.top, box.width, box.height]; })];
    stable = ready && previous?.length === geometry.length && geometry.every((value, index) => Math.abs(value - previous![index]!) <= 1) ? stable + 1 : 0;
    previous = geometry;
    if (stable >= 2) { reveal(); return; }
    animation = requestAnimationFrame(tick);
  }
  animation = requestAnimationFrame(tick);
  return cancel;
}
