import { AwsRum } from 'aws-rum-web';
import {memoryCredentials} from './analytics-credentials.mjs';
export async function createRum(config) {
  const credentials = memoryCredentials(config.identityPoolId);
  await credentials();
  const client = new AwsRum(config.monitorId, '1.0.0', 'us-east-2', {
    endpoint: 'https://dataplane.rum.us-east-2.amazonaws.com',
    allowCookies: false, enableXRay: false, disableAutoPageView: true,
    telemetries: [], recordResourceUrl: false, sessionSampleRate: 1,
    sessionEventLimit: 200, dispatchInterval: 5000,
    // No HTTP, error, DOM, resource or replay plugins: only explicit measurements.
  });
  client.setAwsCredentials(credentials);
  return client;
}
