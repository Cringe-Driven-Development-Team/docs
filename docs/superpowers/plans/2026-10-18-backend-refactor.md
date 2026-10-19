# Рефакторинг backend — план реализации API-15

**Цель:** разделить ответственности backend и завершить обработку ошибок пароля
по требованиям задачи №15 и ревью PR #34.

**Архитектура:** domain содержит предметные типы; usecase объявляет порты;
HTTP и адаптеры реализуют внешние границы; app соединяет реализации.
Политика аутентификации задаётся OpenAPI, CSRF разделён на signer/guard/bootstrap.

**Стек:** Go 1.27.1, net/http, Gorilla mux, pgx/v5, AWS SDK, bcrypt, oapi-codegen.

**Спека:** [границы слоёв, сессии и HTTP-контракт](../specs/2026-10-18-backend-refactor-design.md).

**Задача:** [backend#15](https://github.com/Cringe-Driven-Development-Team/backend/issues/15).
**Ревью:** [PR #34](https://github.com/Cringe-Driven-Development-Team/backend/pull/34).

## Состояние и порядок выполнения

Редакция от 19 октября 2026 года, проверенный SHA backend — `31ab4ec`.
Этапы 1–5 уже реализованы; их чекбоксы отражают результаты сверки кода и проверок.
Порядок написания старых тестов до реализации по текущему дереву не восстанавливается.
Заново выполнять переносы и изменение Apidog не требуется.

Продолжение работы начинается с этапа 6 — исправления замечания ментора,
затем этап 7 закрывает документацию и повторяет проверки изменённого кода.
Пустой чекбокс означает конкретную оставшуюся работу. Протокол ранее выполненных
проверок приведён отдельно в конце; он не заменяет повторный запуск после исправления.

## Общие ограничения

- Все пути исходников и команды относятся к корню backend; рабочая ветка api-15.
- Перед изменением сверить git status и HEAD, сохранить имеющиеся изменения.
- Сохраняются маршруты, JSON и политика сессий; исключение — 500 при сбое Compare.
- Generated Go изменяется только через генератор из согласованного Apidog main.
- Без Redis, BFF, новых ручек, миграций, gomock/sqlmock и изменения ротации.
- Контекст запроса передаётся дальше; ошибки сохраняют исходную причину.
- Коммиты, push, публикацию PR и merge выполняет автор изменений.
- Спека и план хранятся в docs; личные настройки не включаются в изменения проекта.

## На что обратить внимание при ревью

| Сценарий | Ожидаемое поведение | Проверка |
| --- | --- | --- |
| Повреждённый хеш вместо неверного пароля | Внутренняя ошибка, без новой сессии | Этап 6: адаптер, Login, HTTP |
| Повреждённая или дублированная CSRF-cookie | Отказ без исправления исходного запроса | Этап 4: существующие CSRF/bootstrap-тесты |
| Bootstrap и успешный вход выдают cookie | Приоритет cookie результата сессии | Этап 4: тест ротации cookie |
| Ошибка crypto/codec до записи | Нет новой сессии или файла/метаданных | Этап 2: тесты отказов портов |
| Изменение контракта или путей генерации | Схема проверена, повторная генерация совпадает | Этапы 5 и 7 |

## Карта файлов

| Этап | Создаваемые или изменяемые компоненты | Тесты и настройки |
| --- | --- | --- |
| 1. Слои | internal/{user,notebook}/{domain,usecase,delivery/http,adapters}, internal/transport/http/{router,server}.go | Перенесённые тесты, .golangci.yml |
| 2. Порты | internal/{user,notebook}/usecase/ports.go, user/adapters/security, notebook/adapters/ipynb | usecase/ports_test.go обоих доменов |
| 3. Config/export | internal/config/config.go, internal/app/{app,run}.go, internal/tooling/apidog/export.go, cmd/apidog/main.go | config/config_test.go, tooling/apidog/export_test.go |
| 4. HTTP | transport/http/security/{csrf,guard,bootstrap,pipeline}.go, cookies/session.go, user/delivery/http/{user,refresh}.go | transport/http/csrf*_test.go, security/guard_test.go, cookies/session_test.go |
| 5. OpenAPI | transport/http/api/{api.gen.go,cfg.yaml}, middleware/validator.go | middleware/validator_test.go, Makefile, scripts/test.sh |
| 6. Пароль | user/usecase/{ports,user}.go, user/adapters/security/password.go | Тесты адаптера, usecase и delivery/http |
| 7. Передача | README.md, AGENTS.md при необходимости | Полные проверки и итоговый отчёт |

Пути в таблице, кроме явно указанных корневых файлов, находятся внутри internal.
Для выполненных этапов перечислены конечные файлы, а не команды повторного переноса.

### Этап 1: Границы слоёв и сборка HTTP

**Контракты:** domain.User, domain.Notebook и domain.Cell; usecase.Session;
HTTP-конструктор NewRouter возвращает `(http.Handler, error)` и получает Server,
TokenParser, CORS origins, CSRFSigner, CSRF TTL, RefreshUserResolver и appOrigin.
App создаёт реализации, обработчики работают через прикладные контракты.

- [x] **Шаг 1. Проверить перенос.** Domain, usecase, delivery/http и adapters расположены согласно §4 спеки; HTTP-роутер и его тесты находятся в transport/http.
- [x] **Шаг 2. Проверить зависимости.** `go list` для domain/usecase показывает отсутствие HTTP, адаптеров и конкретной crypto; depguard закрепляет ограничения.
- [x] **Шаг 3. Проверить порты хранения.** UserStore и SessionStore принадлежат user/usecase; Metadata и Files — notebook/usecase; результаты сессии отделены от domain.User.
- [x] **Шаг 4. Проверить сборку и регрессии.** `make check` успешно выполняет сборку и все тесты с race; перенос не изменил generated-код вне embedded spec.

### Этап 2: Криптография и ipynb через порты

**Контракты:** PasswordHasher.Hash, TokenIssuer.Issue, RefreshTokens.New/Hash,
NotebookCodec.Parse/Build. Исходный Compare возвращает error; целевой контракт
из §5.2 спеки внедряется на этапе 6. NewUserUsecase получает UserStore, SessionStore,
TokenIssuer, PasswordHasher, RefreshTokens и refreshTTL; NewNotebookUsecase —
Metadata, Files и NotebookCodec.

- [x] **Шаг 1. Проверить внедрение.** Конструкторы принимают порты; bcrypt/JWT/refresh находятся в user/adapters/security, ipynb — в notebook/adapters/ipynb.
- [x] **Шаг 2. Проверить отказы пользователя.** TestPasswordHashFailureDoesNotCreateUser сохраняет причину ошибки и запрещает запись пользователя/сессии; TestTokenIssueFailureDoesNotCreateSession запрещает создание сессии.
- [x] **Шаг 3. Проверить отказ кодека.** TestCodecFailureDoesNotCreateNotebook сохраняет ошибку и подтверждает отсутствие новых метаданных и файла.
- [x] **Шаг 4. Проверить совместимость подмен.** Существующие подмены адаптированы без gomock; все перечисленные тесты прошли в составе make check.

### Этап 3: Конфигурация, запуск и экспорт

**Контракты:** config.Load() (Config, error), Config.PostgresURL() string;
apidog.Run(context.Context, Options) error. Options содержит Out, EnvFile, Client,
LookupEnv и Log. Cmd/apidog передаёт CLI-параметры в Run.

- [x] **Шаг 1. Проверить конфигурацию.** TestLoadDefaultsAndOverrides проверяет defaults, overrides и fallback длительности; TestMissingRequiredSettings — JWT_SECRET, CSRF_SECRET, S3_NOTEBOOKS_BUCKET; TestPostgresURLCredentials — экранирование URL.
- [x] **Шаг 2. Проверить границу CLI.** Cmd/apidog содержит разбор аргументов и завершение; HTTP, env-файл и вывод находятся в tooling/apidog, сборка и запуск — в app.
- [x] **Шаг 3. Проверить экспорт.** TestExportFromEnvFileAndEnvironment проверяет приоритет окружения, параметры запроса и передачу context; TestExportRejectsInvalidConfigurationAndResponses — неверную ветку, 401, неверный формат и ошибку upstream без выходного файла.
- [x] **Шаг 4. Выполнить тесты.** Config/export и остальная сборка прошли в составе make check; тесты экспортёра используют подменённый HTTP-клиент.

### Этап 4: CSRF, resolver и cookie

**Контракты:** CSRFSigner.Anonymous/Signed/Valid;
RefreshUserResolver.ResolveRefresh(context.Context, string) (RefreshIdentity, error);
CSRFGuard.CheckRefresh(context.Context, string, *string) error;
SessionCookies.Session/Clear и cookies.CSRF(string, time.Duration).

- [x] **Шаг 1. Проверить разделение.** Signer не создаёт http.Cookie; guard проверяет запрос; bootstrap согласует восстановление; SessionCookies задаёт cookie результата сессии.
- [x] **Шаг 2. Проверить resolver.** User delivery преобразует ErrInvalidRefresh в Valid=false; общий HTTP security не импортирует ошибки usecase. TestRefreshGuardUsesResolvedOwner проверяет владельца, недействующую сессию и инфраструктурный сбой.
- [x] **Шаг 3. Проверить порядок middleware.** RequestID → Logging → Recover → CORS → CSRF/Authenticate → Validator; общие обёртки охватывают ранние ответы и маршрутизацию.
- [x] **Шаг 4. Выполнить регрессионные тесты.** CSRF/bootstrap/origin-тесты прошли: отказ сохраняет refresh-сессию, повреждённая подпись не исправляется, cookie ротации имеет приоритет.

### Этап 5: Контракт авторизации и генерация

**Контракты:** cookieAuth = apiKey/cookie/access_token. Список защищённых и публичных
OperationID задан в §7 спеки; рабочая авторизация использует OpenAPI.

- [x] **Шаг 1. Проверить validator.** TestRequireUserRejectsUnsupportedSecurityScheme допускает cookieAuth, отклоняет bearerAuth, неизвестную схему, неверную cookie и способ передачи.
- [x] **Шаг 2. Проверить операции.** TestContractOperationSecurityPolicy сверяет шесть защищённых и четыре публичные операции и обнаруживает неклассифицированные операции.
- [x] **Шаг 3. Проверить источник.** Два экспорта Apidog main совпали. Генерация по cfg.yaml дважды дала одинаковый api.gen.go, совпавший с Git.
- [x] **Шаг 4. Проверить инфраструктуру генерации.** Makefile использует новый путь; scripts/test.sh исключает generated API из coverage; код вне embedded spec совпадает с исходной базой.

### Этап 6: Отказ проверки пароля и неверный пароль

**Статус:** не выполнен. Основание — замечание ментора в PR #34.

**Файлы:** изменить internal/user/usecase/{ports,user}.go и
internal/user/adapters/security/password.go; адаптировать реализации PasswordHasher,
включая failedHasher в usecase/ports_test.go. Добавить adapters/security/password_test.go;
дополнить usecase/ports_test.go и delivery/http/user_test.go. Найти остальные реализации
по ссылкам на символ перед изменением сигнатуры.

**Контракт:** Compare(hash, password string) (matched bool, err error).
Hash остаётся прежним. ErrMismatchedHashAndPassword → false, nil;
другая ошибка bcrypt → false, err. Login сначала обрабатывает err, затем !matched.

- [ ] **Шаг 1. Зафиксировать регрессию Login до изменения контракта.** Добавить TestPasswordCompareFailureDoesNotCreateSession на текущем интерфейсе: Hash работает, Compare возвращает sentinel-ошибку. Проверить errors.Is(resultErr, sentinel), отсутствие ErrInvalidCredentials, отсутствие вызовов TokenIssuer и CreateSession. Запустить `go test ./internal/user/usecase -run TestPasswordCompareFailureDoesNotCreateSession -count=1`; ожидается FAIL из-за потери причины ошибки.
- [ ] **Шаг 2. Добавить тест контракта адаптера.** TestPasswordHasherCompare проверяет правильный пароль (true, nil), неверный (false, nil), короткий повреждённый хеш и хеш с неподдерживаемой версией (false, err). Использовать настоящий хеш bcrypt для первых двух случаев; будущую версию получить заменой маркера валидного хеша. Запустить `go test ./internal/user/adapters/security -run TestPasswordHasherCompare -count=1`; до изменения сигнатуры ожидается ошибка несовпадения числа результатов.
- [ ] **Шаг 3. Изменить порт и реализации.** В ports.go и password.go ввести целевую сигнатуру; только errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) преобразовать в false, nil. Остальные ошибки сохранить. Адаптировать подмены, включая тест шага 1.
- [ ] **Шаг 4. Исправить Login.** Сбой Compare возвращать с fmt.Errorf и %w; !matched преобразовать в ErrInvalidCredentials. В обеих ветках возврат происходит до startSession. Проверить диагностику и запустить `go test ./internal/user/usecase ./internal/user/adapters/security -count=1`; ожидается PASS.
- [ ] **Шаг 5. Закрепить несовпадение.** Добавить TestPasswordMismatchDoesNotCreateSession с false, nil: ErrInvalidCredentials, ноль вызовов TokenIssuer и CreateSession. Проверить прежний успешный вход TestUserUsecaseLogin. Ожидается PASS для `go test ./internal/user/usecase -count=1`.
- [ ] **Шаг 6. Проверить HTTP и логирование.** Дополнить TestHandlerErrors для Login: прикладное несовпадение → 401; sentinel внутренней ошибки → 500, причина присутствует в захваченном серверном логе и отсутствует в JSON. При отказе нет cookie новой access/refresh-сессии; отдельная bootstrap CSRF-cookie допустима. Запустить `go test ./internal/user/delivery/http -count=1`; ожидается PASS. Общий обработчик ошибок менять только при выявленном несоответствии.
- [ ] **Шаг 7. Проверить весь домен.** Запустить `go test ./internal/user/... -count=1`; ожидается PASS. Сверить таблицу результатов Compare из спеки с тестами всех трёх границ.

### Этап 7: Документация и передача на повторное ревью

**Файлы:** README.md; AGENTS.md только если обнаружены неточные пути; этот план
для записи новых результатов. Исходники других задач не изменяются.

- [ ] **Шаг 1. Исправить пример пути.** В README заменить internal/user/delivery/user.go на internal/user/delivery/http/user.go. Сверить остальные примеры с существующими файлами; карта архитектуры уже обновлена. Проверить, что AGENTS.md остаётся не длиннее 150 строк.
- [ ] **Шаг 2. Запустить итоговые проверки после этапа 6.** `make check`, `make docker-build`, `git diff --check`; ожидаются exit 0, отсутствие замечаний lint и успешная сборка образа. При недоступном gopls используются go vet и сборка из make check.
- [ ] **Шаг 3. Проверить объём изменения.** `git diff --stat` и `git diff` показывают исправление Compare, необходимые подмены/тесты и README. Если generated-код менялся, повторить генерацию из одного согласованного контракта и сравнить результаты.
- [ ] **Шаг 4. Записать результаты и передать автору.** Указать новый SHA либо явно незакоммиченный diff, команды, результаты, ограничения и закрытие замечания 401/500. Автор публикует изменения для повторного ревью; текущий CHANGES_REQUESTED не считать снятым автоматически.

## Результаты проверки 19 октября 2026 года

Проверен backend `api-15`, SHA `31ab4ecda248ddbf20ef1eb692a8230ea9d65f23`;
HEAD совпал с PR #34. До и после проверки рабочее дерево backend чистое.

| Проверка | Результат |
| --- | --- |
| `make check` | Успешно: синтаксис shell, gofmt, `go vet`, `go mod tidy -diff`, сборка, race-тесты с `-count=1`, lint |
| Покрытие `scripts/test.sh` | 73,3% после предусмотренных проектом исключений |
| Линтер | 0 issues |
| `make docker-build` | Успешно, образ `colab-backend:local`, ID `045531776fbd` |
| `git diff --check` | Успешно |
| Импорты domain/usecase через `go list` | Нет зависимостей от HTTP, адаптеров и конкретной криптографии |
| Экспорт Apidog main и генерация | Два экспорта совпали; два результата генерации совпали друг с другом и с `api.gen.go` в Git |
| Generated-код относительно исходной базы | Вне встроенной OpenAPI-спецификации содержимое совпадает |
| gopls | Не видит Go-модуль из корня workspace; использованы `go vet`, сборка и lint |

Генерация проверена теми же экспортёром, конфигурацией и генератором, что вызывает
`make generate`; результаты направлены во временный каталог, исходники не заменялись.
При экспорте `APIDOG_BRANCH_ID` задан пустым, поэтому использован main.
SHA256 результата: `d2eee2d63b4c192d892793bd685d34a167712ce9564a04c8ba4b8697b820106c`.

Для запуска использованы доступные для записи каталоги кеша:

```bash
GOCACHE=/tmp/cdd-api15-go-cache GOLANGCI_LINT_CACHE=/tmp/cdd-api15-lint-cache make check
make docker-build
git diff --check
```

Тесты `TestPasswordHashFailureDoesNotCreateUser`,
`TestTokenIssueFailureDoesNotCreateSession`, `TestCodecFailureDoesNotCreateNotebook`,
тесты config/export, `TestRefreshGuardUsesResolvedOwner`,
`TestRequireUserRejectsUnsupportedSecurityScheme`, `TestContractOperationSecurityPolicy`
и существующие HTTP/CSRF/bootstrap/origin-тесты прошли в составе `make check`.
Это подтверждает текущее поведение; порядок написания тестов до реализации
по текущему дереву установить нельзя. Исторические RED-запуски не считаются
подтверждёнными и не включены в список оставшихся продуктовых работ.
