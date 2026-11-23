"""Run on the dedicated Neuro Diversa deployment. Never prints secret values.

Reuses the installed Olivia 3.6 engine and platform AI provider, with a new
database, restricted SQL role, technical identity and system instructions.
Does not create human accounts or configure SMTP/Buffer.
"""
import base64, json, os, secrets, subprocess, sys
from pathlib import Path

ROOT = Path('/opt/o7/apps/neurodiversa')
if Path.cwd() != ROOT:
    raise SystemExit('Run only from /opt/o7/apps/neurodiversa')
os.umask(0o077)
def read_env(name):
    return dict(line.split('=', 1) for line in (ROOT/name).read_text().splitlines() if '=' in line and not line.startswith('#'))
def write_env(name, values):
    path=ROOT/name
    path.write_text(''.join(f'{key}={value}\n' for key,value in values.items()))
    path.chmod(0o600)
def sql(value):
    subprocess.run(['docker','exec','-i','neurodiversa-olivia36-db','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','neurodiversa'],input=value.encode(),check=True,stdout=subprocess.DEVNULL)
phase=sys.argv[1]
if phase=='configure':
    if (ROOT/'.env').exists():
        assert (ROOT/'.env.core').exists() and (ROOT/'.env.db').exists()
        print('Existing Neuro Diversa credentials preserved.')
        sys.exit(0)
    source=json.loads(subprocess.check_output(['docker','inspect','olivia-v2']))[0]
    current=dict(item.split('=',1) for item in source['Config']['Env'] if '=' in item)
    assert current.get('OPENAI_API_KEY'), 'Existing platform AI provider is required'
    password=secrets.token_urlsafe(40)
    write_env('.env.db',{'POSTGRES_DB':'neurodiversa','POSTGRES_USER':'postgres','POSTGRES_PASSWORD':secrets.token_urlsafe(40)})
    write_env('.env.core',{
        'DATABASE_URL':f'postgresql+psycopg://neurodiversa_app:{password}@postgres:5432/neurodiversa',
        'OPENAI_API_KEY':current['OPENAI_API_KEY'],'EMBEDDING_PROVIDER':'openai','EMBEDDING_MODEL':'text-embedding-3-small','EMBEDDING_DIMENSIONS':'1536',
        'JWT_SECRET':secrets.token_urlsafe(48),'VAULT_MASTER_KEY':base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),'BOOTSTRAP_KEY':secrets.token_urlsafe(48),
        'OPENAI_MODEL_FAST':'gpt-4.1-mini','OPENAI_MODEL_BALANCED':'gpt-4.1-mini','OPENAI_MODEL_POWERFUL':'gpt-4.1-mini',
        'CHAT_TIMEOUT_SECONDS':'45','CHAT_MAX_HISTORY_MESSAGES':'20','LOCAL_LLM_ENABLED':'false','RAG_TOP_K':'3',
        'CHAT_SYSTEM_INSTRUCTIONS_FILE':'/app/site-instructions.txt','RATE_LIMIT_PER_MINUTE':'60',
    })
    write_env('.env',{
        'SITE_URL':'https://neurodiversa.mx','DB_PATH':'/data/neurodiversa.sqlite','GATEWAY_KEY':secrets.token_urlsafe(48),
        'AUTH_SECRET':secrets.token_urlsafe(48),'VAULT_KEY':secrets.token_urlsafe(48),
        'OLIVIA_API_URL':'http://core:8093','OLIVIA_EMAIL':'neurodiversa-service@internal.o7digital.com','OLIVIA_PASSWORD':secrets.token_urlsafe(40),
    })
    (ROOT/'.bootstrap.json').write_text(json.dumps({'app_password':password,'owner_email':'neurodiversa-core@internal.o7digital.com','owner_password':secrets.token_urlsafe(40)}))
    subprocess.run(['docker','tag','luxuryvillas-olivia36-core:9286428','neurodiversa-olivia36-core:9286428'],check=True)
    data=ROOT/'data';data.mkdir(mode=0o700,exist_ok=True);os.chown(data,1000,1000)
    print('Dedicated secrets prepared; no human accounts created.')
elif phase=='database':
    credentials=json.loads((ROOT/'.bootstrap.json').read_text())
    sql("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='neurodiversa_app') THEN CREATE ROLE neurodiversa_app LOGIN PASSWORD '"+credentials['app_password']+"'; END IF; END $$;")
    sql('CREATE EXTENSION IF NOT EXISTS vector; GRANT USAGE,CREATE ON SCHEMA public TO neurodiversa_app;')
    print('Dedicated database and restricted role ready.')
elif phase=='isolate':
    sql("""DO $$ DECLARE row record; BEGIN FOR row IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',row.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',row.table_name);
    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=row.table_name AND policyname='tenant_isolation') THEN
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',row.table_name);
    END IF; END LOOP; END $$;""")
    print('Tenant isolation installed.')
elif phase=='bootstrap':
    if (ROOT/'.bootstrapped').exists():
        print('Technical identity already initialized.');sys.exit(0)
    payload=json.loads((ROOT/'.bootstrap.json').read_text());payload.update(read_env('.env'))
    script="""
import os,sys,json,urllib.request,urllib.error
p=json.load(sys.stdin)
def request(path,body,token=None,bootstrap=False):
 headers={'Content-Type':'application/json','X-Tenant-ID':'neurodiversa'}
 if token:headers['Authorization']='Bearer '+token
 if bootstrap:headers['X-Bootstrap-Key']=os.environ['BOOTSTRAP_KEY']
 req=urllib.request.Request('http://localhost:8093'+path,data=json.dumps(body).encode(),headers=headers)
 try:return json.load(urllib.request.urlopen(req,timeout=50))
 except urllib.error.HTTPError as error:
  if error.code==409:return {'exists':True}
  raise
owner={'email':p['owner_email'],'password':p['owner_password']}
request('/v1/auth/bootstrap',owner,bootstrap=True)
token=request('/v1/auth/login',owner)['access_token']
request('/v1/auth/users',{'email':p['OLIVIA_EMAIL'],'password':p['OLIVIA_PASSWORD'],'role':'service'},token)
service=request('/v1/auth/login',{'email':p['OLIVIA_EMAIL'],'password':p['OLIVIA_PASSWORD']})['access_token']
print('Neuro Diversa Olivia 3.6 service identity ready.')
"""
    result=subprocess.run(['docker','exec','-i','neurodiversa-olivia36','python','-c',script],input=json.dumps(payload).encode(),capture_output=True)
    if result.returncode:raise SystemExit('Core bootstrap failed; inspect the dedicated service without exposing credentials.')
    print(result.stdout.decode().strip());(ROOT/'.bootstrapped').write_text('Technical identity initialized\n')
else:
    raise SystemExit('Unknown phase')
