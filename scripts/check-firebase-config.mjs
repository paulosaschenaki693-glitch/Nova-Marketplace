const required = ['FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing Firebase environment variables: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Firebase environment variables are present. This check does not verify credentials or authentication settings.');
}
