// Extends app.json. For an Android build, set GOOGLE_MAPS_ANDROID_API_KEY (EAS: `eas env:create`) so the in-app map works.
// Without it the Map tab shows a branch list instead (a Google map created with no key crashes the Android app).
// `extra.googleMapsEnabled` tells the app at runtime that a key was built in; the key itself is not read by the JS.
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!key) return config;
  return {
    ...config,
    android: { ...config.android, config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } } },
    extra: { ...(config.extra ?? {}), googleMapsEnabled: true },
  };
};
