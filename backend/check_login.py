import json
import urllib.request
import urllib.error

body = json.dumps({"username_or_email": "principal_user", "password": "Principal@123!"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/auth/login/",
    data=body,
    headers={"Content-Type": "application/json"},
)

try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print("STATUS", resp.status)
        print(resp.read().decode())
except urllib.error.HTTPError as e:
    print("STATUS", e.code)
    print(e.read().decode())
except Exception as e:
    print("ERR", repr(e))
