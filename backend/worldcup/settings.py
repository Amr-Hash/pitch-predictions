import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

IS_VERCEL = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None

SECRET_KEY = config("SECRET_KEY", default="django-insecure-dev-key-change-in-production")
DEBUG = config("DEBUG", default=not IS_VERCEL, cast=bool)
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1,backend,.vercel.app" if IS_VERCEL else "localhost,127.0.0.1,backend",
    cast=Csv(),
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "accounts",
    "groups",
    "tournaments",
    "predictions",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "worldcup.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "worldcup.wsgi.application"

if IS_VERCEL and not os.environ.get("DATABASE_URL"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.dummy",
        }
    }
else:
    DATABASES = {
        "default": dj_database_url.config(
            default=config(
                "DATABASE_URL",
                default="postgres://alhabeed:alhabeed@localhost:5432/alhabeed",
            ),
            conn_max_age=0 if IS_VERCEL else 600,
            conn_health_checks=not IS_VERCEL,
        )
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
if IS_VERCEL:
    STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
else:
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "auth": "10/minute",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "SIGNING_KEY": config("JWT_SECRET", default=SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

_default_cors = (
    "http://localhost:3000,http://127.0.0.1:3000,"
    "https://alhabeed.vercel.app,"
    "https://alhabeed-amr-hashem.vercel.app"
)
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default=_default_cors,
    cast=Csv(),
)

if IS_VERCEL:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    CSRF_TRUSTED_ORIGINS = config(
        "CSRF_TRUSTED_ORIGINS",
        default=(
            "https://alhabeed.vercel.app,"
            "https://alhabeed-amr-hashem.vercel.app,"
            "https://alhabeed-api.vercel.app,"
            "https://alhabeed-api-amr-hashem.vercel.app"
        ),
        cast=Csv(),
    )

SPECTACULAR_SETTINGS = {
    "TITLE": "الهبيد API",
    "DESCRIPTION": "Football match prediction competitions API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)

# Predictions lock when kickoff_time is reached (0 = at kickoff, not before).
PREDICTION_LOCK_HOURS = 0

# Avoid 301 redirect loops when API is proxied through Vercel (trailing-slash mismatch)
APPEND_SLASH = False
