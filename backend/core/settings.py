from pathlib import Path
import os
# pyrefly: ignore [missing-import]
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


# ==============================
# SECURITY SETTINGS
# ==============================

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")

DEBUG = os.environ.get("DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]

# Trust reverse-proxy headers on Railway so generated media URLs use correct host/protocol.
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

GOOGLE_OAUTH_CLIENT_ID = "".join(
    os.environ.get(
        "GOOGLE_OAUTH_CLIENT_ID",
        "985373381636-pk1i0l5p36u3a11vq1figa30q2mk0a56.apps.googleusercontent.com",
    ).split()
)

CSRF_TRUSTED_ORIGINS = [
    f"https://{host}" for host in ALLOWED_HOSTS if host
]


# ==============================
# APPLICATIONS
# ==============================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',

    # Your apps
    'toilets',
    'complaints',
    'workers',
    'payments',
]


# ==============================
# MIDDLEWARE
# ==============================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',

    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


# ==============================
# STATIC FILES
# ==============================

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}


# ==============================
# URL / WSGI
# ==============================

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# ==============================
# DATABASE (Railway Ready)
# ==============================

DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{(BASE_DIR / 'db.sqlite3').resolve().as_posix()}",
        conn_max_age=600
    )
}


# ==============================
# PASSWORD VALIDATION
# ==============================

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# ==============================
# INTERNATIONALIZATION
# ==============================

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'

USE_I18N = True
USE_TZ = True


# ==============================
# MEDIA FILES
# ==============================

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
os.makedirs(MEDIA_ROOT, exist_ok=True)



# ==============================
# CORS SETTINGS
# ==============================

CORS_ALLOW_ALL_ORIGINS = True


# ==============================
# RAZORPAY
# ==============================

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_ScwQdV0rAVCdZz")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "A66AIPJkazeJV05Plo78T2oq")


# ==============================
# DEFAULT AUTO FIELD
# ==============================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ==============================
# BLYNK SENSOR INTEGRATION
# ==============================

BLYNK_AUTH_TOKEN = os.environ.get(
    "BLYNK_AUTH_TOKEN",
    "RwI3gTiTO-FUZYMjkE0rEYfG1VRWGKID",
)
BLYNK_GAS_PIN = os.environ.get("BLYNK_GAS_PIN", "V0")
BLYNK_WATER_PIN = os.environ.get("BLYNK_WATER_PIN", "V1")
BLYNK_DUSTBIN_PIN = os.environ.get("BLYNK_DUSTBIN_PIN", "V2")
BLYNK_PEOPLE_PIN = os.environ.get("BLYNK_PEOPLE_PIN", "V3")
BLYNK_MOTION_PIN = os.environ.get("BLYNK_MOTION_PIN", "V4")

BLYNK_GAS_HIGH_THRESHOLD = float(os.environ.get("BLYNK_GAS_HIGH_THRESHOLD", 70))
BLYNK_DUSTBIN_FULL_THRESHOLD = float(os.environ.get("BLYNK_DUSTBIN_FULL_THRESHOLD", 80))
BLYNK_WATER_LOW_THRESHOLD = float(os.environ.get("BLYNK_WATER_LOW_THRESHOLD", 20))
BLYNK_CACHE_TTL_SECONDS = float(os.environ.get("BLYNK_CACHE_TTL_SECONDS", 1.0))
BLYNK_REQUEST_TIMEOUT_SECONDS = float(os.environ.get("BLYNK_REQUEST_TIMEOUT_SECONDS", 1.2))
