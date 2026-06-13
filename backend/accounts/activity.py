from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, F, Q
from django.utils import timezone

User = get_user_model()

LAST_SEEN_UPDATE_INTERVAL = timedelta(minutes=5)


def fan_users_queryset():
    return User.objects.filter(is_active=True, is_staff=False)


def maybe_update_last_seen(user) -> None:
    if not user.is_authenticated or not user.is_active:
        return
    now = timezone.now()
    if user.last_seen_at and (now - user.last_seen_at) < LAST_SEEN_UPDATE_INTERVAL:
        return
    User.objects.filter(pk=user.pk).update(last_seen_at=now)
    user.last_seen_at = now


def get_user_activity_summary() -> dict:
    now = timezone.now()
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)

    fans = fan_users_queryset()
    total_fans = fans.count()
    active_24h = fans.filter(last_seen_at__gte=since_24h).count()
    active_7d = fans.filter(last_seen_at__gte=since_7d).count()
    never_seen = fans.filter(last_seen_at__isnull=True).count()
    inactive_7d = fans.filter(
        Q(last_seen_at__isnull=True) | Q(last_seen_at__lt=since_7d)
    ).count()

    return {
        "total_fans": total_fans,
        "active_last_24h": active_24h,
        "active_last_7d": active_7d,
        "active_24h_pct": round((active_24h / total_fans) * 100, 1) if total_fans else 0,
        "active_7d_pct": round((active_7d / total_fans) * 100, 1) if total_fans else 0,
        "never_seen": never_seen,
        "inactive_over_7d": inactive_7d,
        "as_of": now.isoformat(),
    }


def filter_users_by_activity(queryset, activity: str | None):
    if not activity or activity == "all":
        return queryset

    now = timezone.now()
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)

    if activity == "24h":
        return queryset.filter(last_seen_at__gte=since_24h)
    if activity == "7d":
        return queryset.filter(last_seen_at__gte=since_7d)
    if activity == "inactive":
        return queryset.filter(Q(last_seen_at__isnull=True) | Q(last_seen_at__lt=since_7d))
    if activity == "never":
        return queryset.filter(last_seen_at__isnull=True)
    return queryset
