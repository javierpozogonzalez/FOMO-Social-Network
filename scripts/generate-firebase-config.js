const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i)]) {
      process.env[line.slice(0, i)] = line.slice(i + 1).replace(/^['"]|['"]$/g, '')
    }
  }
}

loadEnv(path.join(__dirname, '..', '.env'))
const androidKey = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_API_KEY
const iosKey = process.env.EXPO_PUBLIC_GOOGLE_IOS_API_KEY
if (!androidKey || !iosKey || androidKey.startsWith('your_') || iosKey.startsWith('your_')) {
  throw new Error('Google Firebase API keys are missing in .env')
}

const root = path.join(__dirname, '..')
const android = {
  project_info: { project_number: '548503984704', project_id: 'fomo-analytics', storage_bucket: 'fomo-analytics.firebasestorage.app' },
  client: [{ client_info: { mobilesdk_app_id: '1:548503984704:android:5dbe7c5ed7ffc786a95da5', android_client_info: { package_name: 'com.fomo.mobile' } }, oauth_client: [], api_key: [{ current_key: androidKey }], services: { appinvite_service: { other_platform_oauth_client: [] } } }],
  configuration_version: '1'
}
const ios = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>API_KEY</key><string>${iosKey}</string>
<key>GCM_SENDER_ID</key><string>548503984704</string>
<key>PLIST_VERSION</key><string>1</string>
<key>BUNDLE_ID</key><string>com.fomo.app</string>
<key>PROJECT_ID</key><string>fomo-analytics</string>
<key>STORAGE_BUCKET</key><string>fomo-analytics.firebasestorage.app</string>
<key>IS_ADS_ENABLED</key><false/><key>IS_ANALYTICS_ENABLED</key><false/><key>IS_APPINVITE_ENABLED</key><true/><key>IS_GCM_ENABLED</key><true/><key>IS_SIGNIN_ENABLED</key><true/>
<key>GOOGLE_APP_ID</key><string>1:548503984704:ios:a036ce60267cddf5a95da5</string>
</dict></plist>
`
fs.writeFileSync(path.join(root, 'google-services.json'), JSON.stringify(android, null, 2) + '\n')
fs.writeFileSync(path.join(root, 'GoogleService-Info.plist'), ios)
console.log('Firebase configuration generated from .env')
