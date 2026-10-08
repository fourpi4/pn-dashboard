FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY app ./app

RUN useradd -m pn && chown -R pn:pn /app
USER pn

EXPOSE 8081

CMD ["python", "-m", "app.main", "--host", "0.0.0.0", "--port", "8081"]
