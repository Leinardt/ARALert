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
    throttle_scope = 'anon'

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


class HealthCheckView(APIView):
    """
    GET /api/health/
    Uptime and database connectivity health probe.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'anon'

    def get(self, request):
        from django.db import connection
        db_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            db_ok = False

        status_code = 200 if db_ok else 503
        return Response({
            'status': 'healthy' if db_ok else 'degraded',
            'database': 'connected' if db_ok else 'disconnected',
            'server_time': timezone.now().isoformat(),
        }, status=status_code)
