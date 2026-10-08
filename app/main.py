"""Локальный веб-сервер для дашборда (только стандартная библиотека Python).

    python -m app.main            # http://localhost:8081
    python -m app.main --port 9000

Дашборд можно открыть и без сервера — двойным кликом по app/ui/index.html.
Сервер нужен, чтобы открыть его по адресу (другой браузер, Docker, локальная сеть).
Данные хранятся в браузере (localStorage) отдельно для каждого адреса:
file:///…/index.html и http://localhost:8081 — это разные хранилища.
"""
import argparse
import functools
import http.server
from pathlib import Path

UI_DIR = Path(__file__).resolve().parent / "ui"


def main() -> None:
    ap = argparse.ArgumentParser(description="Подоходный налог · ОФ — локальный сервер")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8081)
    a = ap.parse_args()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(UI_DIR))
    with http.server.ThreadingHTTPServer((a.host, a.port), handler) as srv:
        print(f"Подоходный налог · ОФ: http://{'localhost' if a.host in ('127.0.0.1', '0.0.0.0') else a.host}:{a.port}  (Ctrl+C — остановить)")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
