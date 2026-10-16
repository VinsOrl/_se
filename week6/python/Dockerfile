FROM python:3.12-slim

# Don't write .pyc files, and flush logs immediately so `docker logs` is live
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY app.py .

# Unprivileged user
RUN useradd --system --no-create-home appuser
USER appuser

EXPOSE 5000
CMD ["python", "app.py"]
