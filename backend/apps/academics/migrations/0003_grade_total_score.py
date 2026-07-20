from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0002_grade_batch_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='grade',
            name='total_score',
            field=models.DecimalField(default=0, max_digits=5, decimal_places=2),
            preserve_default=False,
        ),
    ]
