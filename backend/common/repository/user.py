import logging
import time
from typing import Optional, List
from google.cloud.firestore_v1.base_query import FieldFilter
from common.db import get_firestore_client
from common.models.user import UserModel

logger = logging.getLogger("repository.user")

class UserRepository:
    def __init__(self):
        self.client = get_firestore_client()
        self.collection = self.client.collection("users")

    def get_by_email(self, email: str) -> Optional[dict]:
        try:
            docs = self.collection.where(filter=FieldFilter("email", "==", email.lower().strip())).limit(1).stream()
            for doc in docs:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Failed to get user by email: {e}")
            raise e

    def get_all(self) -> List[dict]:
        try:
            docs = self.collection.stream()
            users = [doc.to_dict() for doc in docs]
            users.sort(key=lambda u: u.get("createdAt", 0), reverse=True)
            return users
        except Exception as e:
            logger.error(f"Failed to get all users: {e}")
            return []

    def create(self, user_id: str, email: str, password_hash: str, first_name: str = "", last_name: str = "") -> str:
        try:
            doc_ref = self.collection.document(user_id)
            user_data = UserModel(
                id=user_id,
                email=email.lower().strip(),
                passwordHash=password_hash,
                createdAt=int(time.time() * 1000),
                firstName=first_name,
                lastName=last_name
            )
            doc_ref.set(user_data.model_dump())
            return user_id
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            raise e

    def delete(self, user_id: str):
        try:
            self.collection.document(user_id).delete()
        except Exception as e:
            logger.error(f"Failed to delete user {user_id}: {e}")
            raise e
