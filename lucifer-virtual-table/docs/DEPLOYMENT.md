# Развёртывание Lucifer Virtual Table

Подготовлен вариант для одного Linux-сервера: Caddy с HTTPS → Next.js → отдельная PostgreSQL 18. Наружу доступны только 80/443. Приложение и PostgreSQL не публикуют свои порты. Команды ниже выполняются в папке проекта на сервере с установленными Docker Engine и Compose v2.

Этот комплект подготовлен и проверен по конфигурации; Docker и настоящий VPS в текущей среде не запускались. Локальная standalone-сборка и PostgreSQL проверяются отдельно. Это не заявление о готовности всей VTT к публичному продакшену.

## Подготовка

1. Направьте DNS A-запись домена на сервер. AAAA добавляйте только при работающем IPv6. Откройте TCP 80/443 и UDP 443. Защитите SSH отдельно.
2. Перенесите исходники проекта. Не копируйте `node_modules`, `.next`, `var`, `.env.local`, `work`, `outputs` и локальные секреты. Образы собираются на сервере.
3. Задайте домен и почту для сертификата:

```bash
cp .env.production.example .env.production
nano .env.production
```

```dotenv
DOMAIN=table.example.com
ACME_EMAIL=admin@example.com
```

4. Создайте отдельные пароли администратора PostgreSQL и роли приложения. Не передавайте их через чат:

```bash
umask 077
mkdir -p secrets
openssl rand -hex 32 > secrets/postgres-admin.txt
openssl rand -hex 32 > secrets/app-db.txt
```

Файлы `secrets/` исключены из Docker build context и Git. Они подключаются в контейнеры через Compose secrets. Приложение получает роль `lvt_app` без SUPERUSER/CREATEDB/CREATEROLE. Файлы должны быть доступны контейнеру для чтения через Docker secrets; не добавляйте их в публичный репозиторий.

## Запуск

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail=100 app caddy
curl --fail https://table.example.com/api/health
```

Caddy получает и продлевает TLS-сертификат. Secure cookie включена; внешний origin задан через `PUBLIC_APP_URL`. Caddy перезаписывает адрес клиента перед приложением. Конфигурация рассчитана на прямой доступ к Caddy: при добавлении CDN настройки доверенных прокси нужно пересмотреть.

SSE-поток комнаты не буферизуется прокси. Для игры в разных браузерах войдите в аккаунты, сохраните общую кампанию и используйте приглашение. Независимые демо по корневому адресу не синхронизируются.

Регистрация доступна снаружи. Ограничение частоты запросов есть; подтверждение email и восстановление забытого пароля ещё не реализованы. До публичного запуска нужны эти пользовательские сценарии, проверка восстановления резервных копий и нагрузочная/безопасностная проверка.

## Обновление

Сначала сделайте резервную копию. Затем перенесите новые исходники и повторите `up -d --build`. Миграции применяются приложением перед запуском под блокировкой PostgreSQL. Не редактируйте уже применённые SQL-миграции. Скрипт создания роли PostgreSQL выполняется только при первом создании пустого volume: изменение файла пароля не меняет пароль существующей роли.

## Резервная копия

В БД находятся кампании, аккаунты, история, сессии и загруженные карты. Встроенные модели/текстуры входят в исходники. Для логической копии:

```bash
mkdir -p backups
docker compose --env-file .env.production -f compose.production.yaml exec -T db pg_dump -U postgres -Fc lucifer_vtt > backups/lucifer-vtt.dump
```

Храните копии отдельно от сервера с ограниченным доступом. Файл содержит личные данные и сессии. Проверяйте восстановление в отдельную БД. Для отката версии приложения нужна совместимость с уже применённой схемой; один старый Docker-образ не откатывает БД.

Чтобы перенести локальную базу Windows, создайте `pg_dump` именно базы `lucifer_vtt` на 127.0.0.1:55432, затем восстановите через `pg_restore --no-owner --role=lvt_app` в серверную БД. Не переносите каталог `var/postgres` между ОС. Пароли и данные исходного кластера остаются в локальных игнорируемых файлах.

Документация используемых компонентов: [Compose production](https://docs.docker.com/compose/how-tos/production/), [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
