import logging
import time
from typing import Optional
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

    def create(self, user_id: str, email: str, password_hash: str) -> str:
        try:
            doc_ref = self.collection.document(user_id)
            user_data = UserModel(
                id=user_id,
                email=email.lower().strip(),
                passwordHash=password_hash,
                createdAt=int(time.time() * 1000)
            )
            doc_ref.set(user_data.model_dump())
            return user_id
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            raise e
