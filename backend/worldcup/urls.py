from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.forms import AdminLoginForm
from notifications.views import cron_send_match_reminders
from tournaments.views import (
    cron_cull_cache,
    cron_process_background_jobs,
    cron_purge_expired_tokens,
    cron_sync_live_scores,
)

from .health import health

admin.site.login_form = AdminLoginForm

urlpatterns = [
    path("api/health", health, name="health"),
    path("api/cron/sync-live-scores", cron_sync_live_scores, name="cron-sync-live-scores"),
    path(
        "api/cron/send-match-reminders",
        cron_send_match_reminders,
        name="cron-send-match-reminders",
    ),
    path(
        "api/cron/process-jobs",
        cron_process_background_jobs,
        name="cron-process-jobs",
    ),
    path("api/cron/cull-cache", cron_cull_cache, name="cron-cull-cache"),
    path(
        "api/cron/purge-expired-tokens",
        cron_purge_expired_tokens,
        name="cron-purge-expired-tokens",
    ),
    path("admin/", admin.site.urls),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/auth/", include("accounts.urls")),
    path("api/groups/", include("groups.urls")),
    path("api/groups", include("groups.urls")),
    path("api/tournaments/", include("tournaments.urls")),
    path("api/tournaments", include("tournaments.urls")),
    path("api/predictions/", include("predictions.urls")),
    path("api/predictions", include("predictions.urls")),
    path("api/leaderboards/", include("predictions.leaderboard_urls")),
    path("api/leaderboards", include("predictions.leaderboard_urls")),
    path("api/dashboard/", include("predictions.dashboard_urls")),
    path("api/dashboard", include("predictions.dashboard_urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/notifications", include("notifications.urls")),
]
