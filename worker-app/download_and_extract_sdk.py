import urllib.request
import zipfile
import os

url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
zip_path = r"c:\projects\Sanitrax Toilet\smart-toilet-monitoring-system\worker-app\tools.zip"
target_dir = r"c:\projects\Sanitrax Toilet\smart-toilet-monitoring-system\worker-app\android-sdk\cmdline-tools\latest"

print("Downloading Android Command Line Tools...")
urllib.request.urlretrieve(url, zip_path)

print("Extracting archive...")
os.makedirs(target_dir, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    for member in zip_ref.infolist():
        name = member.filename
        if name.startswith("cmdline-tools/"):
            name = name[len("cmdline-tools/"):]
        if not name:
            continue
        dest_path = os.path.join(target_dir, name)
        if member.is_dir():
            os.makedirs(dest_path, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with zip_ref.open(member) as source, open(dest_path, "wb") as target:
                target.write(source.read())

if os.path.exists(zip_path):
    os.remove(zip_path)
print("Android Command Line Tools successfully installed!")
