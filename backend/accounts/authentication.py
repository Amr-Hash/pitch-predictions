from rest_framework_simplejwt.authentication import JWTAuthentication

from .activity import maybe_update_last_seen


class JWTAuthenticationWithLastSeen(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            maybe_update_last_seen(user)
        return result
