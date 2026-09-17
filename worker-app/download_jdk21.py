import urllib.request
import zipfile
import os

url = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_x64_windows_hotspot_21.0.2_13.zip"
zip_path = r"c:\projects\Sanitrax Toilet\smart-toilet-monitoring-system\worker-app\jdk21.zip"
target_dir = r"c:\projects\Sanitrax Toilet\smart-toilet-monitoring-system\worker-app\jdk21"

print("Downloading OpenJDK 21...")
urllib.request.urlretrieve(url, zip_path)

print("Extracting OpenJDK 21 archive...")
os.makedirs(target_dir, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    for member in zip_ref.infolist():
        name = member.filename
        if name.startswith("jdk-21"):
            # strip outer folder name
            parts = name.split('/', 1)
            if len(parts) > 1:
                name = parts[1]
            else:
                continue
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
print("OpenJDK 21 successfully installed!")
