from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Group, GroupMember

User = get_user_model()


class GroupMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = GroupMember
        fields = ("id", "user", "username", "email", "role", "joined_at")
        read_only_fields = ("id", "user", "joined_at")


class GroupSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    member_count = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "description",
            "icon",
            "created_by",
            "created_by_username",
            "invite_code",
            "invite_link",
            "member_count",
            "is_admin",
            "created_at",
        )
        read_only_fields = ("id", "created_by", "invite_code", "invite_link", "created_at")

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_is_admin(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.memberships.filter(
            user=request.user, role=GroupMember.Role.ADMIN
        ).exists()


class GroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ("name", "description", "icon")


class GroupUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ("name", "description", "icon")
        extra_kwargs = {
            "name": {"required": False},
            "description": {"required": False},
            "icon": {"required": False},
        }


class JoinGroupSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=8, required=False)
    invite_link = serializers.CharField(required=False)

    def validate(self, attrs):
        if not attrs.get("invite_code") and not attrs.get("invite_link"):
            raise serializers.ValidationError(
                "Either invite_code or invite_link is required."
            )
        if attrs.get("invite_link") and not attrs.get("invite_code"):
            link = attrs["invite_link"]
            if "code=" in link:
                attrs["invite_code"] = link.split("code=")[-1].split("&")[0]
            else:
                raise serializers.ValidationError({"invite_link": "Invalid invite link."})
        return attrs


class InviteUserSerializer(serializers.Serializer):
    email = serializers.EmailField()


class AdminGroupListSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "description",
            "icon",
            "created_by",
            "created_by_username",
            "invite_code",
            "member_count",
            "created_at",
        )

    def get_member_count(self, obj):
        return obj.memberships.count()


class AdminGroupDetailSerializer(AdminGroupListSerializer):
    members = GroupMemberSerializer(source="memberships", many=True, read_only=True)

    class Meta(AdminGroupListSerializer.Meta):
        fields = AdminGroupListSerializer.Meta.fields + ("members",)
