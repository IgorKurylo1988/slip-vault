from pydantic import BaseModel

class UserModel(BaseModel):
    id: str
    email: str
    passwordHash: str
    createdAt: int

class UserAuthSchema(BaseModel):
    email: str
    password: str

