import os

from django.http import JsonResponse
from django.views.decorators.http import require_GET


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
            },
            status=503,
        )

    db_ok = True
    db_error = None
    try:
        from django.db import connection

        connection.ensure_connection()
    except Exception as exc:
        db_ok = False
        db_error = str(exc)

    status = 200 if db_ok else 503
    return JsonResponse(
        {
            "status": "ok" if db_ok else "degraded",
            "database": "connected" if db_ok else "unavailable",
            "detail": db_error,
        },
        status=status,
    )
