// Public, write-only Cognito guest authorization; retained in memory only.
export function memoryCredentials(identityPoolId, request = fetch, now = Date.now) {
  let identityId, cached, pending;
  async function call(operation, body) {
    const response = await request('https://cognito-identity.us-east-2.amazonaws.com/', {
      method:'POST', credentials:'omit', referrerPolicy:'no-referrer',
      headers:{'Content-Type':'application/x-amz-json-1.1','X-Amz-Target':'AWSCognitoIdentityService.'+operation},
      body:JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Analytics authorization unavailable');
    return response.json();
  }
  return async () => {
    if (cached && cached.expiration.getTime() > now() + 60000) return cached;
    if (!pending) pending = (async () => {
      if (!identityId) identityId = (await call('GetId', {IdentityPoolId:identityPoolId})).IdentityId;
      const {Credentials:c} = await call('GetCredentialsForIdentity', {IdentityId:identityId});
      cached = {accessKeyId:c.AccessKeyId, secretAccessKey:c.SecretKey, sessionToken:c.SessionToken, expiration:new Date(c.Expiration*1000)};
      return cached;
    })().finally(()=>{pending=undefined;});
    return pending;
  };
}
