import os
import sys
import datetime
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User
from apps.academics.models import ApiAttendance

def seed_dtr():
    print("Seeding Tutor DTR records...")
    tutors = User.objects.filter(role__in=['tutor', 'faculty'])
    
    dates_to_seed = [
        datetime.date(2026, 9, 19), # Today
        datetime.date(2026, 9, 18), # Yesterday
        datetime.date(2026, 9, 17),
        datetime.date(2026, 9, 16),
    ]

    total_created = 0
    for tutor in tutors:
        for idx, log_date in enumerate(dates_to_seed):
            time_in = datetime.time(16, 30, 0) # 4:30 PM on time
            time_out = datetime.time(17, 0, 0)  # 5:00 PM on time
            
            obj, created = ApiAttendance.objects.update_or_create(
                user=tutor,
                date=log_date,
                defaults={
                    'role': tutor.role,
                    'time_in': time_in,
                    'time_out': time_out,
                    'arrival_pm': time_in,
                    'departure_pm': time_out,
                    'status': 'present',
                }
            )
            total_created += 1
            print(f"  - [{tutor.get_full_name()}] {log_date} 4:30 PM - 5:00 PM (created={created})")

    print(f"\nSuccessfully seeded/updated {total_created} DTR records for {tutors.count()} staff/tutors!")

if __name__ == '__main__':
    seed_dtr()
