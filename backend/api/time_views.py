"""
Public authoritative time endpoint.
Provides untamperable current server timestamp, date, time, and timezone.
"""

import time
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny


class ServerTimeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        now = timezone.now()
        local_now = timezone.localtime(now)
        return Response({
            'iso': now.isoformat(),
            'local_iso': local_now.isoformat(),
            'timestamp_ms': int(time.time() * 1000),
            'date': local_now.strftime('%Y-%m-%d'),
            'time': local_now.strftime('%H:%M:%S'),
            'timezone': timezone.get_current_timezone_name(),
            'day_of_week': local_now.strftime('%A'),
        })
