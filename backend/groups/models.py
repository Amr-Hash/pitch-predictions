import secrets
import string

from django.conf import settings
from django.db import models


def generate_invite_code():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


class Group(models.Model):
    class Icon(models.TextChoices):
        UNIVERSITY = "university", "University"
        SCHOOL = "school", "School"
        CLUB_FRIENDS = "club_friends", "Club friends"

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(
        max_length=20,
        choices=Icon.choices,
        default=Icon.CLUB_FRIENDS,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups",
    )
    invite_code = models.CharField(max_length=8, unique=True, default=generate_invite_code)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["invite_code"]),
            models.Index(fields=["created_by"]),
        ]

    def __str__(self):
        return self.name

    @property
    def invite_link(self):
        return f"/groups/join?code={self.invite_code}"


class GroupMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")
        indexes = [
            models.Index(fields=["group", "user"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"
