from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.forms import AdminLoginForm
from .health import health

admin.site.login_form = AdminLoginForm

urlpatterns = [
    path("api/health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/auth/", include("accounts.urls")),
    path("api/groups/", include("groups.urls")),
    path("api/tournaments/", include("tournaments.urls")),
    path("api/predictions/", include("predictions.urls")),
    path("api/leaderboards/", include("predictions.leaderboard_urls")),
    path("api/dashboard/", include("predictions.dashboard_urls")),
]
