"""
Middleware that attaches authoritative server time headers to every HTTP response.
Enables clients to synchronize with the server's tamper-proof clock.
"""

import time
from django.utils import timezone


class ServerTimeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        now = timezone.now()
        response['X-Server-Time'] = now.isoformat()
        response['X-Server-Timestamp'] = str(int(time.time() * 1000))
        return response
