"""
Root API URL configuration.
"""

from django.urls import path, include

urlpatterns = [
    path('auth/', include('api.auth.urls')),
    path('users/', include('api.users.urls')),
    path('profile/', include('api.auth.profile_urls')),
    path('academics/', include('api.academics.urls')),
]
