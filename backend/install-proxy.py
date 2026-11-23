"""Add only the dedicated Neuro Diversa route; validate before reloading nginx."""
from datetime import datetime, timezone
from pathlib import Path
import shutil, subprocess

path=Path('/opt/o7/apps/o7-proxy/proxy/nginx.conf')
original=path.read_text()
marker='location ^~ /neurodiversa-backend/'
if marker in original:
    start=original.index(marker)
    end=original.index('\n        }',start)
    block=original[start:end]
    updated=block.replace('client_max_body_size 100k;', 'client_max_body_size 3m;')
    if updated==block:
        print('Neuro Diversa proxy route is current.')
    else:
        backup=path.with_name('nginx.conf.before-neurodiversa-media-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
        shutil.copy2(path,backup)
        path.write_text(original[:start]+updated+original[end:])
        result=subprocess.run(['docker','exec','o7-proxy','nginx','-t'],capture_output=True)
        if result.returncode:
            path.write_text(original)
            raise SystemExit('Proxy validation failed; original configuration restored.')
        subprocess.run(['docker','exec','o7-proxy','nginx','-s','reload'],check=True)
        print('Neuro Diversa media limit updated; backup retained.')
else:
    anchor='        location = /health {'
    assert original.count(anchor)==1, 'Inspect proxy before editing: unexpected health route'
    route='''        # Dedicated Neuro Diversa backend. Browser traffic passes through its Vercel bridge.
        location ^~ /neurodiversa-backend/ {
            set $neurodiversa_backend http://neurodiversa-backend:8080;
            rewrite ^/neurodiversa-backend/(.*)$ /$1 break;
            proxy_pass $neurodiversa_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $http_host;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Neurodiversa-Key $http_x_neurodiversa_key;
            proxy_set_header X-Visitor-IP $http_x_visitor_ip;
            proxy_read_timeout 70s;
            client_max_body_size 3m;
        }

'''
    backup=path.with_name('nginx.conf.before-neurodiversa-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    shutil.copy2(path,backup)
    path.write_text(original.replace(anchor,route+anchor,1))
    result=subprocess.run(['docker','exec','o7-proxy','nginx','-t'],capture_output=True)
    if result.returncode:
        path.write_text(original)
        raise SystemExit('Proxy validation failed; original configuration restored.')
    subprocess.run(['docker','exec','o7-proxy','nginx','-s','reload'],check=True)
    print('Neuro Diversa route installed and proxy reloaded; backup retained.')
