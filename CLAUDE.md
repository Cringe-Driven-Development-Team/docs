# CLAUDE.md

@AGENTS.md

## Только для Claude Code

- Хук `.claude/settings.json` после каждой правки запускает `module-graph check`.
- Скиллы вызываются как `/<имя>`; Claude читает их копию в `.claude/skills/`, править — `.agents/skills/`.
