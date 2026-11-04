/// <reference lib="dom" />

// Serialized into head; keep independent of Vue and module bindings.
function initializeReadingLayout(): void {
  const prefix = 'vitepress-nolebase-enhanced-readabilities-';
  const read = (key: string): string | null => {
    try { return localStorage.getItem(prefix + key); } catch { return null; }
  };
  const savedMode = read('layout-switch-mode');
  const parsedMode = Number.parseFloat(savedMode ?? '1');
  const mode = [1, 3, 4, 5].includes(parsedMode) ? parsedMode : 1;
  if (savedMode !== null && mode !== parsedMode) {
    try { localStorage.setItem(prefix + 'layout-switch-mode', String(mode)); } catch { /* Storage may be unavailable. */ }
  }
  const apply = () => {
    for (const kind of ['page', 'content']) {
      // VueUse reads numbers with parseFloat before Nolebase parses/clamps the slider value.
      const value = Number.parseInt(String(Number.parseFloat(read(`${kind}-layout-max-width`) ?? (kind === 'page' ? '10000' : '8000'))));
      const percent = matchMedia('(min-width: 1440px)').matches
        ? Math.ceil((Number.isNaN(value) ? 10000 : Math.min(10000, Math.max(6000, value))) / 100) : 100;
      document.body.style.setProperty(`--vp-nolebase-enhanced-readabilities-${kind}-max-width`, `${percent}%`);
    }
    for (const [value, name] of [[1, 'FullWidth'], [4, 'SidebarWidthAdjustableOnly'], [5, 'BothWidthAdjustable']] as const)
      document.body.classList.toggle(`VPNolebaseEnhancedReadabilitiesLayoutSwitch${name}`, mode === value);
  };
  if (document.body) { apply(); return; }
  const observer = new MutationObserver(() => {
    if (!document.body) return;
    apply();
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true });
}

export function readingLayoutHeadScript(): string {
  return `(${initializeReadingLayout.toString()})();`;
}
