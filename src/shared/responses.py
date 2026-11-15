from typing import Generic, TypeVar
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(frozen=True)

    success: bool = True
    message: str = "Operation completed successfully"
    data: T
