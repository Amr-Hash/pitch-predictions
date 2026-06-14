import os

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.http import JsonResponse
from django.views.decorators.http import require_GET


def _migration_head_ok() -> tuple[bool, list[str]]:
    try:
        executor = MigrationExecutor(connection)
        targets = executor.loader.graph.leaf_nodes()
        plan = executor.migration_plan(targets)
        pending = [f"{migration.app_label}.{migration.name}" for migration, _ in plan]
        return len(plan) == 0, pending
    except Exception:
        return False, []


@require_GET
def health(request):
    if os.environ.get("VERCEL") and not os.environ.get("DATABASE_URL"):
        return JsonResponse(
            {
                "status": "degraded",
                "database": "not_configured",
                "detail": (
                    "DATABASE_URL is missing. Add Neon Postgres in Vercel: "
                    "Project alhabeed-api → Storage → Create Database → Neon."
                ),
                "git_sha": os.environ.get("GIT_SHA")
                or os.environ.get("VERCEL_GIT_COMMIT_SHA")
                or None,
            },
            status=503,
        )

    db_ok = True
    db_error = None
    try:
        connection.ensure_connection()
    except Exception as exc:
        db_ok = False
        db_error = str(exc)

    migration_head_ok = False
    pending_migrations: list[str] = []
    cache_ok = False
    if db_ok:
        migration_head_ok, pending_migrations = _migration_head_ok()
        try:
            from django.core.cache import cache

            cache.set("health_check", "ok", 10)
            cache_ok = cache.get("health_check") == "ok"
        except Exception:
            cache_ok = False

    overall_ok = db_ok and migration_head_ok and cache_ok
    payload = {
        "status": "ok" if overall_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "cache_ok": cache_ok,
        "migration_head_ok": migration_head_ok,
        "pending_migrations": pending_migrations,
        "detail": db_error,
        "git_sha": os.environ.get("GIT_SHA")
        or os.environ.get("VERCEL_GIT_COMMIT_SHA")
        or None,
    }
    if db_ok and not migration_head_ok:
        payload["detail"] = (
            "Database migrations are pending: " + ", ".join(pending_migrations)
        )

    status_code = 200 if overall_ok else 503
    return JsonResponse(payload, status=status_code)
