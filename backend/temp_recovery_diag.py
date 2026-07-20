import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.test import Client
from apps.accounts.models import User
import traceback

User.objects.filter(email='recoverytest2@example.com').delete()
User.objects.create_user(username='recoverytest2', email='recoverytest2@example.com', first_name='R', last_name='T', role='faculty', password='OldPassword123!', is_active=True)
c = Client()
try:
    response = c.post('/api/auth/forgot-password/', {'email': 'recoverytest2@example.com'}, content_type='application/json')
    print('status', response.status_code)
    print(response.content.decode())
except Exception as exc:
    print(type(exc).__name__, exc)
    traceback.print_exc()
