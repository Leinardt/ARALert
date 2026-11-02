from django.db import migrations, models


def add_attendance_school_year_column_and_backfill(apps, schema_editor):
    from django.db import connection
    if 'api_attendance' in connection.introspection.table_names():
        with connection.cursor() as cursor:
            if connection.vendor == 'sqlite':
                cursor.execute("PRAGMA table_info(api_attendance)")
                cols = [row[1] for row in cursor.fetchall()]
                if cols and 'school_year_id' not in cols:
                    cursor.execute("ALTER TABLE api_attendance ADD COLUMN school_year_id integer REFERENCES school_year(id)")
            else:
                cursor.execute("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='api_attendance' AND column_name='school_year_id'
                        ) THEN
                            ALTER TABLE api_attendance ADD COLUMN school_year_id BIGINT REFERENCES school_year(id) ON DELETE SET NULL;
                        END IF;
                    END $$;
                """)

    SchoolYear = apps.get_model('academics', 'SchoolYear')
    active_sy = SchoolYear.objects.filter(is_active=True).first()
    if active_sy:
        if not getattr(active_sy, 'current_semester', None):
            active_sy.current_semester = '2nd'
            active_sy.save(update_fields=['current_semester'])
        with connection.cursor() as cursor:
            if connection.vendor == 'sqlite':
                cursor.execute("UPDATE api_attendance SET school_year_id = ? WHERE school_year_id IS NULL", [active_sy.id])
            else:
                cursor.execute("UPDATE api_attendance SET school_year_id = %s WHERE school_year_id IS NULL", [active_sy.id])


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0004_schoolyear_alter_apigrade_options_studentenrollment_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='schoolyear',
            name='current_semester',
            field=models.CharField(
                choices=[('1st', '1st'), ('2nd', '2nd'), ('summer', 'summer')],
                default='2nd',
                max_length=10,
                verbose_name='Current Semester',
            ),
        ),
        migrations.RunPython(
            add_attendance_school_year_column_and_backfill,
            reverse_code=migrations.RunPython.noop,
        ),
    ]

