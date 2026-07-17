import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='grade',
            name='batch_id',
            field=models.UUIDField(default=uuid.uuid4, editable=False),
            preserve_default=False,
        ),
    ]
