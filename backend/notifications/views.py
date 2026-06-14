from rest_framework import permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from tournaments.views import _authorize_cron_request

from .models import Notification, PushSubscription
from .serializers import (
    NotificationSerializer,
    PushSubscribeSerializer,
    PushUnsubscribeSerializer,
)
from .services.push import push_configured, vapid_public_key


class NotificationListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
        unread_only = request.query_params.get("unread") == "1"
        if unread_only:
            qs = qs.filter(is_read=False)
        limit = min(int(request.query_params.get("limit", 50)), 100)
        notifications = qs[:limit]
        unread_count = Notification.objects.filter(
            user=request.user, is_read=False
        ).count()
        return Response(
            {
                "unread_count": unread_count,
                "results": NotificationSerializer(notifications, many=True).data,
            }
        )


class NotificationMarkReadView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        updated = Notification.objects.filter(
            user=request.user, is_read=False
        ).update(is_read=True)
        return Response({"detail": "All notifications marked as read.", "updated": updated})


class PushVapidPublicKeyView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response(
            {
                "public_key": vapid_public_key(),
                "configured": push_configured(),
            }
        )


class PushSubscribeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = PushSubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:255]
        subscription, _created = PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={
                "user": request.user,
                "p256dh": data["p256dh"],
                "auth": data["auth"],
                "user_agent": user_agent,
            },
        )
        return Response(
            {"detail": "Subscribed.", "id": subscription.id},
            status=status.HTTP_201_CREATED,
        )


class PushUnsubscribeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = PushUnsubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deleted, _ = PushSubscription.objects.filter(
            user=request.user,
            endpoint=serializer.validated_data["endpoint"],
        ).delete()
        if not deleted:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Unsubscribed."})


@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def cron_send_match_reminders(request):
    """
    HTTP trigger for kickoff reminders (cron-job.org in production).
    Send: Authorization: Bearer <CRON_SECRET>
    """
    if not _authorize_cron_request(request):
        return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    from notifications.services.match_reminders import send_match_kickoff_reminders

    return Response(send_match_kickoff_reminders())
