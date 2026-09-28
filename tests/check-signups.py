"""Integration checks against the local PHP preview; uses disposable example.com records only."""
import concurrent.futures, json, sqlite3, subprocess, time, uuid
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
BASE='http://127.0.0.1:8778/api/interest.php'
ROOT=Path(__file__).resolve().parents[1]
DB=ROOT.parent/'fast-private/interests.sqlite'
PHP=['/Users/jacobcloete/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node','/private/tmp/fast-php-test/node_modules/@php-wasm/cli/php-wasm.js']
tag='fast-test-'+uuid.uuid4().hex[:10]
def request(data, origin='http://127.0.0.1:8778'):
    r=Request(BASE,data=json.dumps(data).encode(),headers={'Content-Type':'application/json','Origin':origin})
    try:
        with urlopen(r,timeout=15) as f:return f.status,json.load(f)
    except HTTPError as e:return e.code,json.load(e)
def signup(n=0, **extra):
    return {'trip':'scotland-2027','name':'Disposable integration test','email':f'{tag}-{n}@example.com','consent':True,**extra}
def cli(action, ident):
    return subprocess.run(PHP+[str(ROOT/'tools/manage-interest.php'),action,str(ident)],capture_output=True,text=True,cwd=ROOT)
tokens=[]
try:
    code,body=request(signup(),origin='https://unrelated.example');assert code==403
    code,body=request(signup(consent=False));assert code==422
    code,body=request(signup(email='not-an-email'));assert code==422
    code,body=request(signup(trip='invented'));assert code==422
    code,body=request(signup());assert code==201,(code,body);tokens.append(body['manageToken'])
    code,body=request(signup());assert code==200 and 'manageToken' not in body
    # Two simultaneous requests for one email must create only one record/token.
    with concurrent.futures.ThreadPoolExecutor(2) as pool:r=list(pool.map(lambda _:request(signup(1)),range(2)))
    assert sorted(x[0] for x in r)==[200,201],r
    tokens += [x[1]['manageToken'] for x in r if 'manageToken' in x[1]]
    for n in range(2,5):
        code,body=request(signup(n));assert code==201,(code,body);tokens.append(body['manageToken'])
    with sqlite3.connect(DB) as db:
        rows=db.execute('SELECT id FROM interests WHERE email LIKE ? ORDER BY id',(tag+'%',)).fetchall()
        assert len(rows)==5
    for row in rows[:4]:
        result=cli('confirm',row[0]);assert 'Updated' in result.stdout,(result.stdout,result.stderr)
    result=cli('confirm',rows[4][0]);assert 'Four guests are already confirmed' in result.stderr,(result.stdout,result.stderr)
    with sqlite3.connect(DB) as db:assert db.execute('SELECT COUNT(*) FROM interests WHERE email LIKE ? AND status="confirmed"',(tag+'%',)).fetchone()[0]==4
    code,body=request({'action':'withdraw','token':tokens[0]});assert code==200
    with sqlite3.connect(DB) as db:assert db.execute('SELECT COUNT(*) FROM interests WHERE email=?',(signup()['email'],)).fetchone()[0]==0
    code,body=request({'action':'withdraw','token':tokens[0]});assert code==200
    # Check oversize and malformed private link failures.
    code,_=request(signup(name='x'*5000));assert code==413
    code,_=request({'action':'withdraw','token':'invalid'});assert code==400
    # Exhaust the limiter with rejected input; no extra personal records.
    for _ in range(16):
        code,_=request(signup(consent=False))
        if code==429:break
    assert code==429
    print('PASS: validation, cross-origin rejection, deduplication, concurrent duplicate, four-guest cap, withdrawal, oversized input and rate limit.')
finally:
    if DB.exists():
        with sqlite3.connect(DB) as db:
            db.execute('DELETE FROM interests WHERE email LIKE ?',(tag+'%',))
            # Local test instance only, for subsequent manual browser checks.
            db.execute('DELETE FROM requests')
