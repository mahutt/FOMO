Example commands to re-deploy from within EC2 instance:

```
#!/bin/bash

cd /opt/FOMO
sudo git pull origin main
source /opt/FOMO/server/venv/bin/activate
pip install -r /opt/FOMO/server/requirements.txt
sudo systemctl restart fastapi.service
sudo systemctl status fastapi.service
```
