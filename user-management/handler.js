'use strict';

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.process = async (event) => {
  const records = event.Records.map(async (record) => {
    if (record.eventSource === 'aws:s3') {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key;

      try {
        const params = {
          Bucket: bucket,
          Key: key
        };
        
        const data = await s3.getObject(params).promise();
        const fileContent = data.Body.toString('utf-8');
        const userData = parseUserData(fileContent);

        if (userData) {
          const dbParams = {
            TableName: 'user-data-table',
            Item: userData
          };

          await dynamoDb.put(dbParams).promise();
        }

      } catch (error) {
        console.error(error);
      }
    }
    else if (record.eventSource === 'aws:sqs') {
      const messageBody = record.body;
      const userData = parseUserData(messageBody);

      if (userData) {
        const dbParams = {
          TableName: 'user-data-table',
          Item: userData
        };

        try {
          await dynamoDb.put(dbParams).promise();
          console.log('Data saved to DynamoDB:', userData);
        } catch (error) {
          console.error('Error saving data to DynamoDB:', error);
        }
      }
    }
  });

  await Promise.all(records);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Data processed successfully',
      input: event,
    }),
  };
};

function parseUserData(fileContent) {
  const lines = fileContent.split('\n');
  const userData = {};

  lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      if (trimmedKey === 'user_id') {
        userData.user_id = trimmedValue;
      } else if (trimmedKey === 'user_name') {
        userData.user_name = trimmedValue;
      } else if (trimmedKey === 'phone_number') {
        userData.phone_number = trimmedValue;
      }
    }
  });

  return userData.user_id ? userData : null;
}
