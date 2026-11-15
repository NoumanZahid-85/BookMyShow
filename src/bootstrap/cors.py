from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.bootstrap.config import settings


def setup_cors(app: FastAPI) -> None:
    allow_origins = ["*"] if settings.debug else ["https://yourdomain.com"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
