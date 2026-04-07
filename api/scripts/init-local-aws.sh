#!/bin/sh
set -e

# Wait for LocalStack
echo "Waiting for LocalStack..."
until curl -s http://localstack:4566 > /dev/null; do
  sleep 1
done
echo "LocalStack is ready!"

# Wait for Cognito Local
echo "Waiting for Cognito Local..."
until curl -s http://cognito-local:9229 > /dev/null; do
  sleep 1
done
echo "Cognito Local is ready!"

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1

# Create S3 Bucket
echo "Creating S3 Upload Bucket..."
aws s3 mb s3://site-uploads \
  --endpoint-url http://localstack:4566 \
  --region us-east-1 > /dev/null 2>&1 || true

# Configure CORS for S3 Bucket
echo "Configuring CORS for S3 Upload Bucket..."
cat << 'CORS' > /tmp/cors.json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "POST", "GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
CORS
aws s3api put-bucket-cors \
  --bucket site-uploads \
  --cors-configuration file:///tmp/cors.json \
  --endpoint-url http://localstack:4566 \
  --region us-east-1 > /dev/null 2>&1 || true

# Create DynamoDB table
echo "Creating DynamoDB table..."
aws dynamodb create-table \
  --endpoint-url http://localstack:4566 \
  --table-name test-table \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-east-1 > /dev/null 2>&1 || true

# Deploy Lambda Function
echo "Deploying Lambda function..."
# Create a dummy execution role
aws iam create-role \
  --endpoint-url http://localstack:4566 \
  --role-name lambda-execution-role \
  --assume-role-policy-document '{"Version": "2012-10-17","Statement": [{"Action": "sts:AssumeRole","Principal": {"Service": "lambda.amazonaws.com"},"Effect": "Allow","Sid": ""}]}' \
  --region us-east-1 > /dev/null 2>&1 || true

# Create the Lambda functions
aws lambda create-function \
  --endpoint-url http://localstack:4566 \
  --function-name asset-upload-listener \
  --runtime nodejs24.x \
  --role arn:aws:iam::000000000000:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb:///packages/asset-upload-listener/lambda.zip \
  --environment Variables="{DYNAMODB_ENDPOINT=http://localstack:4566,DYNAMODB_TABLE=test-table,S3_ENDPOINT=http://localstack:4566,AWS_REGION=us-east-1}" \
  --region us-east-1 > /dev/null 2>&1 || true

aws lambda create-function \
  --endpoint-url http://localstack:4566 \
  --function-name asset-splat-transform \
  --runtime nodejs24.x \
  --role arn:aws:iam::000000000000:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb:///packages/asset-splat-transform/lambda.zip \
  --environment Variables="{S3_ENDPOINT=http://localstack:4566,AWS_REGION=us-east-1}" \
  --timeout 900 \
  --memory-size 10240 \
  --region us-east-1 > /dev/null 2>&1 || \

echo "Waiting for Lambda functions to become active..."
aws lambda wait function-active-v2 \
  --endpoint-url http://localstack:4566 \
  --function-name asset-upload-listener \
  --region us-east-1 > /dev/null 2>&1 || true

aws lambda wait function-active-v2 \
  --endpoint-url http://localstack:4566 \
  --function-name asset-splat-transform \
  --region us-east-1 > /dev/null 2>&1 || true

# Enable EventBridge notifications on the upload bucket so that both Lambdas
# can be triggered independently via EventBridge rules. Direct S3→Lambda
# notifications cannot have two rules with the same prefix filter.
echo "Enabling S3 EventBridge notifications..."
aws s3api put-bucket-notification-configuration \
  --bucket site-uploads \
  --notification-configuration '{"EventBridgeConfiguration":{}}' \
  --endpoint-url http://localstack:4566 \
  --region us-east-1 > /dev/null 2>&1 || true

# Grant EventBridge permission to invoke each Lambda
aws lambda add-permission \
  --endpoint-url http://localstack:4566 \
  --function-name asset-upload-listener \
  --principal events.amazonaws.com \
  --statement-id eb-invoke-upload-listener \
  --action "lambda:InvokeFunction" \
  --region us-east-1 > /dev/null 2>&1 || true

aws lambda add-permission \
  --endpoint-url http://localstack:4566 \
  --function-name asset-splat-transform \
  --principal events.amazonaws.com \
  --statement-id eb-invoke-splat-transform \
  --action "lambda:InvokeFunction" \
  --region us-east-1 > /dev/null 2>&1 || true

# Create EventBridge rules routing Object Created events to each Lambda
echo "Creating EventBridge rules..."
UPLOAD_RULE_ARN=$(aws events put-rule \
  --endpoint-url http://localstack:4566 \
  --name asset-upload-listener-rule \
  --event-pattern '{"source":["aws.s3"],"detail-type":["Object Created"],"detail":{"bucket":{"name":["site-uploads"]},"object":{"key":[{"prefix":"assets/"}]}}}' \
  --state ENABLED \
  --region us-east-1 \
  --query 'RuleArn' --output text 2>/dev/null) || true

TRANSFORM_RULE_ARN=$(aws events put-rule \
  --endpoint-url http://localstack:4566 \
  --name asset-splat-transform-rule \
  --event-pattern '{"source":["aws.s3"],"detail-type":["Object Created"],"detail":{"bucket":{"name":["site-uploads"]},"object":{"key":[{"prefix":"assets/"}]}}}' \
  --state ENABLED \
  --region us-east-1 \
  --query 'RuleArn' --output text 2>/dev/null) || true

aws events put-targets \
  --endpoint-url http://localstack:4566 \
  --rule asset-upload-listener-rule \
  --targets '[{"Id":"upload-listener","Arn":"arn:aws:lambda:us-east-1:000000000000:function:asset-upload-listener"}]' \
  --region us-east-1 > /dev/null 2>&1 || true

aws events put-targets \
  --endpoint-url http://localstack:4566 \
  --rule asset-splat-transform-rule \
  --targets '[{"Id":"splat-transform","Arn":"arn:aws:lambda:us-east-1:000000000000:function:asset-splat-transform"}]' \
  --region us-east-1 > /dev/null 2>&1 || true

# Create Cognito User Pool
echo "Creating Cognito User Pool..."
POOL_ID=$(aws cognito-idp create-user-pool \
  --endpoint-url http://cognito-local:9229 \
  --pool-name test-pool \
  --region us-east-1 \
  --query 'UserPool.Id' --output text 2>/dev/null)

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  # Maybe it exists already?
  POOL_ID="us-east-1_test-pool"
fi

echo "User Pool ID: $POOL_ID"

# Create Cognito User Pool Client
echo "Creating Cognito User Pool Client..."
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --endpoint-url http://cognito-local:9229 \
  --user-pool-id "$POOL_ID" \
  --client-name test-client \
  --callback-urls "http://localhost:5173/" \
  --logout-urls "http://localhost:5173/" \
  --supported-identity-providers "COGNITO" \
  --allowed-o-auth-flows "code" "implicit" \
  --allowed-o-auth-scopes "openid" "email" "profile" \
  --allowed-o-auth-flows-user-pool-client \
  --explicit-auth-flows "USER_PASSWORD_AUTH" \
  --region us-east-1 \
  --query 'UserPoolClient.ClientId' --output text 2>/dev/null)

echo "User Pool Client ID: $CLIENT_ID"

# Generate random password
ADMIN_PASS=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#%^&*()' </dev/urandom | head -c 16)
ADMIN_USER="admin@local.test"

# Create Cognito User
echo "Creating Cognito Admin User..."
aws cognito-idp admin-create-user \
  --endpoint-url http://cognito-local:9229 \
  --user-pool-id "$POOL_ID" \
  --username "$ADMIN_USER" \
  --user-attributes Name=email,Value="$ADMIN_USER" Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region us-east-1 > /dev/null 2>&1 || true

# Set password
aws cognito-idp admin-set-user-password \
  --endpoint-url http://cognito-local:9229 \
  --user-pool-id "$POOL_ID" \
  --username "$ADMIN_USER" \
  --password "$ADMIN_PASS" \
  --permanent \
  --region us-east-1 > /dev/null 2>&1 || true

echo "--------------------------------------------------------"
echo "Cognito Admin User created!"
echo "Username: $ADMIN_USER"
echo "Password: $ADMIN_PASS"
echo "--------------------------------------------------------"

# Generate auth token
echo "Generating auth token..."
AUTH_RESULT=$(aws cognito-idp initiate-auth \
  --endpoint-url http://cognito-local:9229 \
  --client-id "$CLIENT_ID" \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME="$ADMIN_USER",PASSWORD="$ADMIN_PASS" \
  --region us-east-1 2>/dev/null || true)

# Using simple parsing to avoid jq dependency in base aws-cli image
ID_TOKEN=$(echo "$AUTH_RESULT" | grep -o '"IdToken": "[^"]*' | grep -o '[^"]*$' || echo "")
ACCESS_TOKEN=$(echo "$AUTH_RESULT" | grep -o '"AccessToken": "[^"]*' | grep -o '[^"]*$' || echo "")

if [ -n "$ID_TOKEN" ]; then
  echo "Tokens generated successfully!"
  echo "--------------------------------------------------------"
  echo "Identity Token:"
  echo "$ID_TOKEN"
  echo "--------------------------------------------------------"
  echo "Access Token:"
  echo "$ACCESS_TOKEN"
  echo "--------------------------------------------------------"
fi

echo "Writing environment variables to .development.env on the host..."
cat <<EOF > /workspace/.env.local
USER_POOL_ID=$POOL_ID
USER_POOL_CLIENT_ID=$CLIENT_ID
DYNAMODB_TABLE_NAME=test-table
S3_UPLOAD_BUCKET=site-uploads
EOF
echo ".env.local created!"
