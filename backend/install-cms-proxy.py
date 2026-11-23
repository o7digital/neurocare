from pathlib import Path
from datetime import datetime,timezone
import shutil,subprocess
p=Path('/opt/o7/apps/o7-proxy/proxy/nginx.conf');original=p.read_text()
if 'location ^~ /neurodiversa-cms/' in original: print('Neuro Diversa CMS proxy already installed.');raise SystemExit(0)
anchor='        location = /health {'
assert original.count(anchor)==1
route='''        # Isolated Neuro Diversa Directus Studio.
        location = /neurodiversa-cms { return 302 /neurodiversa-cms/admin; }
        location ^~ /neurodiversa-cms/ {
            set $neurodiversa_cms http://neurodiversa-cms:8055;
            rewrite ^/neurodiversa-cms/(.*)$ /$1 break;
            proxy_pass $neurodiversa_cms;
            proxy_http_version 1.1;
            proxy_set_header Host $http_host;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 70s;
            client_max_body_size 20m;
        }

'''
shutil.copy2(p,p.with_name('nginx.conf.before-neurodiversa-cms-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')))
p.write_text(original.replace(anchor,route+anchor,1))
r=subprocess.run(['docker','exec','o7-proxy','nginx','-t'],capture_output=True)
if r.returncode: p.write_text(original);raise SystemExit('Validation failed; original restored')
subprocess.run(['docker','exec','o7-proxy','nginx','-s','reload'],check=True)
print('Dedicated Directus proxy installed; configuration validated.')
