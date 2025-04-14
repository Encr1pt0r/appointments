const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const { v4: uuidv4 } = require("uuid");

// AWS config
const REGION = process.env.AWS_REGION;
const ROLE_ARN = `arn:aws:iam::${process.env.ACCOUNT_NO}:role/access-appointments`;
const BUCKET_NAME = process.env.BUCKET_NAME;

// Function to assume IAM role and return temporary credentials
async function getTemporaryCredentials() {
  const stsClient = new STSClient({ region: REGION });

  const command = new AssumeRoleCommand({
    RoleArn: ROLE_ARN,
    RoleSessionName: `appointments-session-${Date.now()}`,
    DurationSeconds: 3600,
  });

  const response = await stsClient.send(command);
  const { AccessKeyId, SecretAccessKey, SessionToken } = response.Credentials;

  return {
    accessKeyId: AccessKeyId,
    secretAccessKey: SecretAccessKey,
    sessionToken: SessionToken,
  };
}

exports.handler = async (event) => {
  try {
    const appointmentData = JSON.parse(event.body);

    const creds = await getTemporaryCredentials();

    const s3Client = new S3Client({
      region: REGION,
      credentials: creds,
    });

    const appointmentId = uuidv4();
    const doctorId = appointmentData.doctorId;
    const patientId = appointmentData.patientId;

    const key = `appointments/${doctorId}/${patientId}/${appointmentId}.json`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(appointmentData),
      ContentType: "application/json",
    });

    await s3Client.send(command);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Appointment created",
        appointmentId,
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to create appointment",
      }),
    };
  }
};