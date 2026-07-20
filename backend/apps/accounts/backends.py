from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

from apps.accounts.models import User


class EmailOrUsernameBackend(ModelBackend):
    """Authenticate users using either username or email."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None

        try:
            user = User.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except User.DoesNotExist:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
