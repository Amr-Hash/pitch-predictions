from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
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
