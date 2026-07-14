"""
Profile API URL — separated so it mounts at /api/profile/ (not /api/auth/profile/).
"""

from django.urls import path
from .views import ProfileView

urlpatterns = [
    path('', ProfileView.as_view(), name='user-profile'),
]
