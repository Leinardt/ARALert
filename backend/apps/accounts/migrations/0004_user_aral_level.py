from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_user_assessment_weight_user_assigned_tutor_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='aral_level',
            field=models.CharField(
                choices=[
                    ('basic', 'Basic'),
                    ('plus', 'Plus'),
                    ('summer', 'Summer'),
                ],
                default='basic',
                max_length=10,
                verbose_name='ARAL Level',
                help_text='Student ARAL program level.',
            ),
        ),
    ]
