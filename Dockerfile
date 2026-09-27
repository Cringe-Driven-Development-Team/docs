# Образ рендера схем: Chromium, шрифты и Node из образа Playwright той же версии, что
# playwright-core рендерера (bun.lock), плюс bun. Локально и в CI рендер идёт в нём,
# чтобы dist/ совпадал. Спека: docs/superpowers/specs/2026-09-27-docker-render-design.md §4.
FROM mcr.microsoft.com/playwright:v1.61.1-noble

# В образе есть npm, но нет unzip, поэтому bun ставится из npm.
# Путь к Chromium содержит номер сборки: прячем его за постоянным.
# git: репозиторий смонтирован с чужим владельцем; build-site.ts тянет ветки по HTTPS без SSH-ключей.
RUN npm install -g bun@1.3.13 \
 && ln -s /ms-playwright/chromium-*/chrome-linux64/chrome /usr/local/bin/chromium \
 && git config --system --add safe.directory '*' \
 && git config --system url."https://github.com/".insteadOf "git@github.com:"

ENV CHROMIUM_PATH=/usr/local/bin/chromium DIAGRAMS_IN_CONTAINER=1
