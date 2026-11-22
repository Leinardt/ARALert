from django.db import migrations


def add_acknowledged_at_column(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        existing_tables = connection.introspection.table_names(cursor)
        if 'academic_risks' not in existing_tables:
            return
        columns = [
            col.name
            for col in connection.introspection.get_table_description(cursor, 'academic_risks')
        ]
        if 'acknowledged_at' in columns:
            return
        if connection.vendor == 'postgresql':
            cursor.execute(
                'ALTER TABLE academic_risks ADD COLUMN acknowledged_at TIMESTAMP WITH TIME ZONE NULL;'
            )
        else:
            cursor.execute(
                'ALTER TABLE academic_risks ADD COLUMN acknowledged_at DATETIME NULL;'
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0006_cleanup_legacy_and_rename_tables'),
    ]

    operations = [
        migrations.RunPython(add_acknowledged_at_column, noop_reverse),
    ]
