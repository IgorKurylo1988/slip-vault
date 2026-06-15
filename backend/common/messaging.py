import os
import json
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("messaging")

class CloudMessaging(ABC):
    @abstractmethod
    def publish_message(self, message_data: dict) -> bool:
        """
        Publishes a message containing invoice task details to the queue/topic.
        """
        pass

    @abstractmethod
    def receive_messages(self, wait_time_seconds: int = 10) -> list:
        """
        Synchronously polls for messages.
        Returns a list of dicts: [{'id': msg_id, 'receipt_handle': handle, 'body': body_dict}]
        """
        pass

    @abstractmethod
    def delete_message(self, receipt_handle: str) -> bool:
        """
        Deletes or acknowledges a message from the queue/subscription using its identifier.
        """
        pass

class DummyMessaging(CloudMessaging):
    """In-memory or print logger mock driver for local testing without cloud queues"""
    def publish_message(self, message_data: dict) -> bool:
        logger.info(f"[DUMMY MESSAGING] Published message: {message_data}")
        return True

    def receive_messages(self, wait_time_seconds: int = 10) -> list:
        return []

    def delete_message(self, receipt_handle: str) -> bool:
        logger.info(f"[DUMMY MESSAGING] Deleted/Acknowledged message: {receipt_handle}")
        return True

class GCPPubSubMessaging(CloudMessaging):
    """GCP Pub/Sub Provider (supports local Pub/Sub emulators via PUBSUB_EMULATOR_HOST)"""
    def publish_message(self, message_data: dict) -> bool:
        project_id = os.getenv("GCP_PROJECT_ID")
        topic_id = os.getenv("GCP_PUBSUB_TOPIC_ID")
        if not project_id or not topic_id:
            logger.warning("GCP Project or Topic ID not configured. Skipping GCP Pub/Sub publish.")
            return False

        try:
            from google.cloud import pubsub_v1
            # Client automatically detects and respects PUBSUB_EMULATOR_HOST environment variable
            publisher = pubsub_v1.PublisherClient()
            topic_path = publisher.topic_path(project_id, topic_id)

            data_str = json.dumps(message_data)
            data_bytes = data_str.encode("utf-8")

            future = publisher.publish(topic_path, data_bytes)
            message_id = future.result()
            logger.info(f"Published message to GCP Pub/Sub. Message ID: {message_id}")
            return True
        except Exception as e:
            logger.error(f"GCP Pub/Sub publish failed: {str(e)}")
            return False

    def receive_messages(self, wait_time_seconds: int = 10) -> list:
        project_id = os.getenv("GCP_PROJECT_ID")
        subscription_id = os.getenv("GCP_PUBSUB_SUBSCRIPTION_ID")
        if not project_id or not subscription_id:
            logger.warning("GCP Project or Subscription ID not configured. Cannot poll Pub/Sub.")
            return []

        try:
            from google.cloud import pubsub_v1
            # Client automatically detects and respects PUBSUB_EMULATOR_HOST environment variable
            subscriber = pubsub_v1.SubscriberClient()
            subscription_path = subscriber.subscription_path(project_id, subscription_id)

            # Synchronous pull with a deadline
            response = subscriber.pull(
                request={"subscription": subscription_path, "max_messages": 1},
                timeout=wait_time_seconds
            )

            result = []
            for received_message in response.received_messages:
                message = received_message.message
                try:
                    body = json.loads(message.data.decode("utf-8"))
                    result.append({
                        "id": message.message_id,
                        "receipt_handle": received_message.ack_id,
                        "body": body
                    })
                except Exception as parse_err:
                    logger.error(f"Failed to parse Pub/Sub message JSON: {str(parse_err)}")
            return result
        except Exception:
            return []

    def delete_message(self, receipt_handle: str) -> bool:
        project_id = os.getenv("GCP_PROJECT_ID")
        subscription_id = os.getenv("GCP_PUBSUB_SUBSCRIPTION_ID")
        if not project_id or not subscription_id:
            return False

        try:
            from google.cloud import pubsub_v1
            # Client automatically detects and respects PUBSUB_EMULATOR_HOST environment variable
            subscriber = pubsub_v1.SubscriberClient()
            subscription_path = subscriber.subscription_path(project_id, subscription_id)

            # Acknowledge the message to remove it from the subscription
            subscriber.acknowledge(
                request={"subscription": subscription_path, "ack_ids": [receipt_handle]}
            )
            logger.info("Successfully acknowledged message in GCP Pub/Sub.")
            return True
        except Exception as e:
            logger.error(f"GCP Pub/Sub ack failed: {str(e)}")
            return False

def get_messaging_provider() -> CloudMessaging:
    """Factory function returning the configured messaging driver"""
    provider_name = os.getenv("MESSAGING_PROVIDER", "GCP_PUBSUB").upper()
    if provider_name == "DUMMY":
        return DummyMessaging()
    else:
        return GCPPubSubMessaging()
