#!/bin/bash
echo "Initializing LocalStack resources..."

# Create S3 Bucket
awslocal s3 mb s3://slip-vault-bucket

# Create SQS Queue
awslocal sqs create-queue --queue-name slip-vault-queue

echo "LocalStack Initialization Complete: Created S3 bucket (slip-vault-bucket) and SQS queue (slip-vault-queue)."
