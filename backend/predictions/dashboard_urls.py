from django.urls import path

from .views import DashboardPendingCountView, DashboardView

urlpatterns = [
    path("", DashboardView.as_view(), name="dashboard"),
    path(
        "pending-count",
        DashboardPendingCountView.as_view(),
        name="dashboard-pending-count",
    ),
]
