from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from predictions.models import Prediction
from tournaments.models import Match
from tournaments.serializers import MatchSerializer

from .models import Group, GroupMember
from worldcup.permissions import IsAdminUser

from .serializers import (
    AdminGroupDetailSerializer,
    AdminGroupListSerializer,
    GroupCreateSerializer,
    GroupMemberSerializer,
    GroupSerializer,
    InviteUserSerializer,
    JoinGroupSerializer,
)

User = get_user_model()


class IsGroupAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            group = obj
        elif isinstance(obj, GroupMember):
            group = obj.group
        else:
            return False
        return group.memberships.filter(
            user=request.user, role=GroupMember.Role.ADMIN
        ).exists()


class IsGroupMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.memberships.filter(user=request.user).exists()


class AdminGroupViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (permissions.IsAuthenticated, IsAdminUser)
    pagination_class = None

    def get_queryset(self):
        return (
            Group.objects.all()
            .select_related("created_by")
            .prefetch_related(
                Prefetch(
                    "memberships",
                    queryset=GroupMember.objects.select_related("user").order_by(
                        "joined_at"
                    ),
                )
            )
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AdminGroupDetailSerializer
        return AdminGroupListSerializer


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Group.objects.filter(memberships__user=self.request.user).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return GroupCreateSerializer
        return GroupSerializer

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        GroupMember.objects.create(
            group=group,
            user=self.request.user,
            role=GroupMember.Role.ADMIN,
        )
        serializer.instance = group

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = GroupSerializer(serializer.instance, context={"request": request})
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["post"], url_path="join")
    def join(self, request):
        serializer = JoinGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["invite_code"].upper()
        try:
            group = Group.objects.get(invite_code=code)
        except Group.DoesNotExist:
            raise ValidationError({"invite_code": "Invalid invitation code."})
        if group.memberships.filter(user=request.user).exists():
            raise ValidationError({"detail": "You are already a member of this group."})
        GroupMember.objects.create(group=group, user=request.user)
        return Response(
            GroupSerializer(group, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="invite",
        permission_classes=[permissions.IsAuthenticated, IsGroupAdmin],
    )
    def invite(self, request, pk=None):
        group = self.get_object()
        serializer = InviteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        invite_url = request.build_absolute_uri(group.invite_link)
        send_mail(
            subject=f"Invitation to join {group.name}",
            message=(
                f"You have been invited to join the group '{group.name}'.\n"
                f"Use invite code: {group.invite_code}\n"
                f"Or join via link: {invite_url}"
            ),
            from_email=None,
            recipient_list=[email],
        )
        return Response(
            {
                "detail": "Invitation sent.",
                "invite_code": group.invite_code,
                "invite_link": group.invite_link,
            }
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="members",
    )
    def members(self, request, pk=None):
        group = self.get_object()
        if not group.memberships.filter(user=request.user).exists():
            raise PermissionDenied("You are not a member of this group.")
        members = group.memberships.select_related("user").order_by("joined_at")
        return Response(GroupMemberSerializer(members, many=True).data)

    @action(
        detail=True,
        methods=["get"],
        url_path="predictions",
    )
    def predictions(self, request, pk=None):
        group = self.get_object()
        if not group.memberships.filter(user=request.user).exists():
            raise PermissionDenied("You are not a member of this group.")

        tournament_id = request.query_params.get("tournament")
        if not tournament_id:
            raise ValidationError({"tournament": "This query parameter is required."})

        members = list(
            group.memberships.select_related("user").order_by("joined_at")
        )
        member_ids = [m.user_id for m in members]

        predictions = Prediction.objects.filter(
            user_id__in=member_ids,
            match__tournament_id=tournament_id,
        ).select_related("user", "predicted_winner_team")
        pred_map = {(p.user_id, p.match_id): p for p in predictions}

        matches = Match.objects.filter(tournament_id=tournament_id).select_related(
            "home_team", "away_team", "winner_team", "stage", "cup_group"
        )

        matches_data = []
        for match in matches:
            revealed = self._group_predictions_revealed(match)
            match_predictions = []
            for membership in members:
                pred = pred_map.get((membership.user_id, match.id))
                match_predictions.append(
                    self._serialize_group_match_prediction(
                        membership, pred, revealed
                    )
                )
            matches_data.append(
                {
                    "match": MatchSerializer(match, context={"request": request}).data,
                    "predictions": match_predictions,
                }
            )

        return Response(
            {
                "group": GroupSerializer(group, context={"request": request}).data,
                "members": GroupMemberSerializer(members, many=True).data,
                "matches": matches_data,
            }
        )

    @staticmethod
    def _group_predictions_revealed(match):
        return match.is_kickoff_locked or match.status in (
            Match.Status.FINISHED,
            Match.Status.LIVE,
        )

    @staticmethod
    def _serialize_group_match_prediction(membership, pred, revealed):
        base = {
            "user_id": membership.user_id,
            "username": membership.user.username,
            "has_prediction": False,
            "is_hidden": False,
            "predicted_home_score": None,
            "predicted_away_score": None,
            "predicted_winner_team": None,
            "points_awarded": 0,
        }
        if not pred:
            return base

        base["has_prediction"] = True
        if not revealed:
            base["is_hidden"] = True
            return base

        base["predicted_home_score"] = pred.predicted_home_score
        base["predicted_away_score"] = pred.predicted_away_score
        base["predicted_winner_team"] = (
            {
                "id": pred.predicted_winner_team.id,
                "name": pred.predicted_winner_team.name,
                "name_ar": pred.predicted_winner_team.name_ar,
                "code": pred.predicted_winner_team.code,
                "flag_url": pred.predicted_winner_team.flag_url,
            }
            if pred.predicted_winner_team
            else None
        )
        base["points_awarded"] = pred.points_awarded
        return base

    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        group = self.get_object()
        try:
            membership = group.memberships.get(user=request.user)
        except GroupMember.DoesNotExist:
            raise PermissionDenied("You are not a member of this group.")
        if membership.user_id == group.created_by_id:
            raise ValidationError(
                {"detail": "Group creators cannot leave this group."}
            )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["delete"],
        url_path="members/(?P<member_id>[^/.]+)",
        permission_classes=[permissions.IsAuthenticated, IsGroupAdmin],
    )
    def remove_member(self, request, pk=None, member_id=None):
        group = self.get_object()
        try:
            membership = group.memberships.get(pk=member_id)
        except GroupMember.DoesNotExist:
            raise ValidationError({"detail": "Member not found."})
        if membership.user_id == group.created_by_id:
            raise ValidationError({"detail": "Cannot remove the group creator."})
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
