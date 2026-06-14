from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)


def vapid_public_key() -> str:
    return os.environ.get("VAPID_PUBLIC_KEY", "").strip()


def push_configured() -> bool:
    return bool(
        vapid_public_key()
        and os.environ.get("VAPID_PRIVATE_KEY", "").strip()
        and os.environ.get("VAPID_ADMIN_EMAIL", "").strip()
    )


def send_push_to_user(user_id: int, *, title: str, body: str, url: str) -> int:
    """Send a Web Push to all subscriptions for a user. Returns send count."""
    if not push_configured():
        return 0

    from notifications.models import PushSubscription

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush is not installed; skipping push delivery")
        return 0

    payload = json.dumps({"title": title, "body": body, "url": url})
    vapid_claims = {"sub": f"mailto:{os.environ['VAPID_ADMIN_EMAIL'].strip()}"}
    sent = 0
    stale_ids: list[int] = []

    for subscription in PushSubscription.objects.filter(user_id=user_id):
        try:
            webpush(
                subscription_info=subscription.as_subscription_info(),
                data=payload,
                vapid_private_key=os.environ["VAPID_PRIVATE_KEY"].strip(),
                vapid_claims=vapid_claims,
                headers={
                    "Urgency": "high",
                    "TTL": "86400",
                },
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in {404, 410}:
                stale_ids.append(subscription.id)
            else:
                logger.warning("Web push failed for user %s: %s", user_id, exc)
        except Exception as exc:
            logger.warning("Web push error for user %s: %s", user_id, exc)

    if stale_ids:
        PushSubscription.objects.filter(id__in=stale_ids).delete()

    return sent


def frontend_base_url() -> str:
    from django.conf import settings

    return settings.FRONTEND_URL.rstrip("/")
