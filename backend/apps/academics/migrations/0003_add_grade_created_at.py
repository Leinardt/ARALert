from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0002_apiacademicrisk_apiaralactivity_apiattendance_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE api_grade ADD COLUMN created_at datetime NULL',
            reverse_sql='ALTER TABLE api_grade DROP COLUMN created_at',
        ),
    ]