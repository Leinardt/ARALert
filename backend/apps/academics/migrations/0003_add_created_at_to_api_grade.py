from django.db import migrations


def add_created_at_if_missing(apps, schema_editor):
    from django.db import connection
    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(api_grade)")
            cols = [row[1] for row in cursor.fetchall()]
            if 'created_at' not in cols:
                cursor.execute("ALTER TABLE api_grade ADD COLUMN created_at datetime")
                cursor.execute("UPDATE api_grade SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
        else:
            cursor.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='api_grade' AND column_name='created_at'
                    ) THEN
                        ALTER TABLE api_grade ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                    END IF;
                END $$;
            """)


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0002_apiacademicrisk_apiaralactivity_apiattendance_and_more'),
    ]

    operations = [
        migrations.RunPython(add_created_at_if_missing, reverse_code=migrations.RunPython.noop),
    ]
