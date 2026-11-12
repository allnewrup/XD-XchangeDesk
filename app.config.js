// Extends app.json. For an Android store build, set GOOGLE_MAPS_ANDROID_API_KEY (EAS: `eas env:create`, or a local env var)
// so the in-app map works; without it the Map tab shows a branch list instead.
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!key) return config;
  return { ...config, android: { ...config.android, config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } } } };
};
