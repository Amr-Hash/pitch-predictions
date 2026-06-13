FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc cron \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000

COPY entrypoint.sh /entrypoint.sh
COPY scheduler-entrypoint.sh /scheduler-entrypoint.sh
COPY cron/crontab /etc/cron.d/alhabeed
RUN chmod +x /entrypoint.sh /scheduler-entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "worldcup.wsgi:application", "--bind", "0.0.0.0:8000"]
