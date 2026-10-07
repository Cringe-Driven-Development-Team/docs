# CSRF: проверка и ограничения

Как проверить защиту руками и чего в ней пока не хватает. Устройство — [«Как устроено»](./),
поведение по шагам — [«Сценарии»](./scenarios).

## Как проверить curl'ом

curl сам хранит cookie в файле и отправляет их, как браузер; заголовок `X-CSRF-Token` берётся из
того же файла. Используйте тестовую учётную запись; файл cookie содержит токены — не
публикуйте его.

```bash
API=https://cellestial.ru/api/v1
cookie_jar=$(mktemp)
csrf_token() { awk '$6 == "__Host-csrf" { print $7 }' "$cookie_jar"; }

# Анонимный токен: ответ гостю 401, но cookie приходит
curl -si -c "$cookie_jar" "$API/users/me"

# Вход с токеном
curl -i -b "$cookie_jar" -c "$cookie_jar" \
  -H "Origin: https://cellestial.ru" -H "X-CSRF-Token: $(csrf_token)" \
  -H 'Content-Type: application/json' -d '{"login":"<логин>","password":"<пароль>"}' \
  "$API/auth/login"

# Тот же запрос без заголовка — 403 csrf_invalid
curl -i -b "$cookie_jar" -H 'Content-Type: application/json' \
  -d '{"login":"<логин>","password":"<пароль>"}' "$API/auth/login"

rm -f "$cookie_jar"
```

Чтобы изобразить чужой сайт, замените `Origin` на `https://evil.example`. Чтобы изобразить
другого пользователя, войдите вторым пользователем в отдельный файл cookie и подставьте его
токен в первый файл и в заголовок.

## Матрица проверок

Прогнана против https://cellestial.ru 07.10.2026 (бэк `4094350`). Значения токенов не
приводятся.

| № | Запрос | Итог |
|---|---|---|
| 1 | `OPTIONS` preflight `register` | `204`, cookie нет |
| 2 | гость `GET /users/me` без cookie | `401 unauthorized`, анонимная `__Host-csrf` |
| 3 | `register` без заголовка | `403 csrf_invalid` |
| 4 | `register`, заголовок не равен cookie | `403 csrf_invalid` |
| 5 | `register`, заголовок без cookie | `403 csrf_invalid`, новая `__Host-csrf` |
| 6 | `register`, `Origin: https://evil.example` | `403 csrf_invalid` |
| 7 | `register` формой `x-www-form-urlencoded` с токеном | `400 validation_error` |
| 8 | `register` корректно | `201`, `access_token`, `refresh_token`, подписанная `__Host-csrf` |
| 9 | `GET /users/me` после регистрации | `200` |
| 10 | `refresh` со старым анонимным токеном | `403 csrf_invalid` |
| 11 | `refresh` корректно | `204`, три новые cookie |
| 12 | `refresh`, заголовок от прошлой ротации | `403 csrf_invalid` |
| 13 | вторая сессия: `GET /users/me` с анонимной cookie | `401`, cookie не ставится |
| 14 | вторая сессия: `login` корректно | `200`, три cookie |
| 15 | вторая сессия с токеном первой сессии того же пользователя | `204`: подпись — на пользователя |
| 16 | `login` с неверным паролем | `401 invalid_credentials` |
| 17 | `logout` без заголовка | `403 csrf_invalid` |
| 18 | `logout` корректно | `204`, cookie входа стёрты, анонимная `__Host-csrf` |
| 19 | `GET /users/me` после `logout` | `401` |
| 20 | `refresh` после `logout` | `401` |
| 21 | `logout` второй сессии | `204` |
| 22 | пользователь Б с подписанным токеном пользователя А, `refresh` | `403 csrf_invalid` |
| 23 | то же, `logout` | `403 csrf_invalid` |
| 24 | вошёл, анонимный токен в cookie и заголовке, `refresh` | `403 csrf_invalid`, в ответе подписанная `__Host-csrf` |
| 25 | то же, `logout` | `403 csrf_invalid` |
| 26 | повтор после 24 с новой cookie | `204` |
| 27 | два `refresh` одновременно с одной cookie | `204` и `401` — [ограничение](#известные-ограничения) |

## Известные ограничения

- **Сессия есть, а `__Host-csrf` нет** — фронт повторяет после `403` только вход и регистрацию,
  поэтому стартовая проверка сессии уводит на вход, а выход и изменения показывают ошибку
  ([сценарий](./scenarios#сессия-есть-host-csrf-нет)). Новые пользователи сюда попадают, только
  если сами удалили cookie; затронуты вошедшие до выкатки CSRF-защиты (07.10.2026, 15:45 по МСК),
  один раз — перезагрузка возвращает их внутрь. Задача —
  [frontend#34](https://github.com/Cringe-Driven-Development-Team/frontend/issues/34).
- **Две вкладки обновляют сессию одновременно** — одна вылетает на вход
  ([сценарий](./scenarios#две-вкладки-обновляют-сессию-одновременно), строка 27). Задача —
  [backend#12](https://github.com/Cringe-Driven-Development-Team/backend/issues/12).
- **Подпись привязана к пользователю, а не к сессии** (строка 15): токен из одной сессии подходит
  к другой сессии того же пользователя. Так записано в ТЗ
  [backend#4](https://github.com/Cringe-Driven-Development-Team/backend/issues/4). Гайдлайн РК1
  считает такую привязку допустимой, но более слабой: OWASP советует привязывать токен к сессии
  ([csrf.md](https://tp-prepare.github.io/technopark-guidelines/rk1/csrf)).
