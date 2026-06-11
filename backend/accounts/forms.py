from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.forms import AuthenticationForm

User = get_user_model()


class AdminLoginForm(AuthenticationForm):
    """Accept email (primary login) or username for Django admin."""

    def clean(self):
        identifier = self.cleaned_data.get("username")
        password = self.cleaned_data.get("password")

        if identifier and password:
            user = authenticate(self.request, username=identifier, password=password)
            if user is None and "@" not in identifier:
                try:
                    match = User.objects.get(username=identifier)
                    user = authenticate(self.request, username=match.email, password=password)
                except User.DoesNotExist:
                    pass

            if user is not None:
                self.confirm_login_allowed(user)
                self.user_cache = user
                return self.cleaned_data

        raise self.get_invalid_login_error()
