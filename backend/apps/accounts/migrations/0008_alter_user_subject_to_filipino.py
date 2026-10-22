# Generated for ARALert subject migration: Reading -> Filipino

from django.db import migrations, models


def migrate_reading_to_filipino(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(subject__iexact='Reading').update(subject='Filipino')
    try:
        ApiGrade = apps.get_model('academics', 'ApiGrade')
        ApiGrade.objects.filter(subject__iexact='Reading').update(subject='Filipino')
    except Exception:
        pass


def reverse_filipino_to_reading(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(subject__iexact='Filipino').update(subject='Reading')
    try:
        ApiGrade = apps.get_model('academics', 'ApiGrade')
        ApiGrade.objects.filter(subject__iexact='Filipino').update(subject='Reading')
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_user_privacy_consent_accepted_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='subject',
            field=models.CharField(
                blank=True,
                choices=[
                    ('Filipino', 'Filipino'),
                    ('Science', 'Science'),
                    ('Math', 'Math'),
                    ('English', 'English'),
                ],
                help_text='Subject handled by the tutor or student subject focus.',
                max_length=20,
                null=True,
                verbose_name='Assigned Subject / Focus',
            ),
        ),
        migrations.RunPython(migrate_reading_to_filipino, reverse_filipino_to_reading),
    ]
