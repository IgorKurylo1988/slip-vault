import os
import bcrypt
import jwt
import datetime

JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_default_key_change_me_in_production")
JWT_ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    """Hashes a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a password against a bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def is_admin_email(email: str) -> bool:
    """Checks if an email belongs to an administrator"""
    if not email:
        return False
    e = email.lower().strip()
    return e.endswith("@slip-vault.com") or "admin" in e

def get_user_role(email: str) -> str:
    """Returns 'ADMIN' or 'USER' based on email criteria"""
    return "ADMIN" if is_admin_email(email) else "USER"

def create_jwt_token(user_id: str, email: str) -> str:
    """Generates a signed JWT containing user identity and role"""
    payload = {
        "sub": user_id,
        "email": email,
        "role": get_user_role(email),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    """Decodes and validates a JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return {}
