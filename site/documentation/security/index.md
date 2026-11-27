# Безопасность

Браузер ограничивает использование cookie и загрузку ресурсов. BFF проверяет происхождение запросов, сессию и входные данные. Клиент выводит текст в DOM и изолирует HTML-результаты вычислений. [Обработка API](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/http.ts#L174-L200), [cookie](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/bff/src/session/cookies.ts#L1-L4), [вывод](https://github.com/Cringe-Driven-Development-Team/frontend/blob/b1baf996fb6753d1a62eab6f874d03dca30faadc/apps/client/src/pages/NotebookPage/Output.tsx#L178-L215).

## Разделы

| Если нужно разобраться | Где искать |
| --- | --- |
| При каких заголовках BFF примет запрос с cookie | [CSRF](/documentation/security/csrf) |
| Как передать данные через bootstrap и отобразить содержимое блокнота | [XSS](/documentation/security/xss) |
| Какие ресурсы и действия разрешает браузер на странице приложения | [CSP](/documentation/security/csp) |

## Границы защиты

`HttpOnly` ограничивает чтение cookie из JavaScript. Браузер по-прежнему может приложить её к запросу. Проверки CSRF ограничивают запросы с других сайтов, безопасный вывод и CSP снижают риск исполнения постороннего кода в приложении. Go проверяет доступ к конкретной операции при вызове от BFF. [Сессия](/documentation/frontend/session), [граница BFF и Go](/documentation/security/csrf#граница-bff-и-go).
