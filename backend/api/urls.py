"""
Root API URL configuration.
"""

from django.urls import path, include
from .time_views import ServerTimeView

urlpatterns = [
    path('time/', ServerTimeView.as_view(), name='server-time'),
    path('auth/', include('api.auth.urls')),
    path('users/', include('api.users.urls')),
    path('profile/', include('api.auth.profile_urls')),
    path('academics/', include('api.academics.urls')),
]
