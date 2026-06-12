from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q

from tournaments.models import StandingRuleSet, Tournament, TournamentSubscription

User = get_user_model()


def get_default_world_cup_tournament() -> Tournament | None:
    tournament = (
        Tournament.objects.filter(
            is_active=True,
            is_archived=False,
        ).filter(
            Q(competition_type=StandingRuleSet.CompetitionType.WORLD_CUP)
            | Q(standing_rule_set__competition_type=StandingRuleSet.CompetitionType.WORLD_CUP)
        )
        .order_by("-year", "-id")
        .first()
    )
    if tournament:
        return tournament
    return (
        Tournament.objects.filter(is_active=True, is_archived=False)
        .order_by("-year", "-id")
        .first()
    )


def subscribe_user_to_tournament(user: User, tournament: Tournament) -> TournamentSubscription:
    subscription, _created = TournamentSubscription.objects.get_or_create(
        user=user,
        tournament=tournament,
    )
    return subscription


def subscribe_user_to_default_world_cup(user: User) -> TournamentSubscription | None:
    if user.is_staff:
        return None
    tournament = get_default_world_cup_tournament()
    if not tournament:
        return None
    return subscribe_user_to_tournament(user, tournament)


def subscribe_all_users_to_default_world_cup() -> int:
    tournament = get_default_world_cup_tournament()
    if not tournament:
        return 0
    created = 0
    for user in User.objects.filter(is_active=True, is_staff=False):
        _subscription, was_created = TournamentSubscription.objects.get_or_create(
            user=user,
            tournament=tournament,
        )
        if was_created:
            created += 1
    return created


def subscribed_user_ids_for_tournament(tournament_id: int) -> set[int]:
    return set(
        TournamentSubscription.objects.filter(tournament_id=tournament_id).values_list(
            "user_id", flat=True
        )
    )


def user_is_subscribed(user_id: int, tournament_id: int) -> bool:
    return TournamentSubscription.objects.filter(
        user_id=user_id, tournament_id=tournament_id
    ).exists()
