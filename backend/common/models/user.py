from typing import Optional
from pydantic import BaseModel, Field

class UserModel(BaseModel):
    id: str
    email: str
    passwordHash: str
    createdAt: int
    firstName: Optional[str] = Field(default="")
    lastName: Optional[str] = Field(default="")

class UserAuthSchema(BaseModel):
    email: str
    password: str

class UserRegisterSchema(BaseModel):
    email: str
    password: str
    firstName: Optional[str] = Field(default="")
    lastName: Optional[str] = Field(default="")

class ForgotPasswordSchema(BaseModel):
    email: str

class ResetPasswordSchema(BaseModel):
    token: str
    newPassword: str
