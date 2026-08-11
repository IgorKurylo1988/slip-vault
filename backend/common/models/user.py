from typing import Optional
from pydantic import BaseModel

class UserModel(BaseModel):
    id: str
    email: str
    passwordHash: str
    createdAt: int
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    avatar: Optional[str] = ""

class UserAuthSchema(BaseModel):
    email: str
    password: str

class UserRegisterSchema(BaseModel):
    email: str
    password: str
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    avatar: Optional[str] = ""

