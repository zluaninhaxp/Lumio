const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

module.exports = config => {
  config = withAndroidManifest(config, result => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = '@xml/lumio_backup_rules';
    app.$['android:dataExtractionRules'] = '@xml/lumio_data_extraction_rules';
    return result;
  });
  return withDangerousMod(config, ['android', async result => {
    const directory = path.join(result.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    fs.mkdirSync(directory, { recursive: true });
    const exclusions = ['root','file','database','sharedpref','external'].map(domain => `    <exclude domain="${domain}" path="."/>`).join('\n');
    fs.writeFileSync(path.join(directory,'lumio_backup_rules.xml'), `<full-backup-content>\n${exclusions}\n</full-backup-content>\n`);
    fs.writeFileSync(path.join(directory,'lumio_data_extraction_rules.xml'), `<data-extraction-rules>\n  <cloud-backup>\n${exclusions}\n  </cloud-backup>\n  <device-transfer>\n${exclusions}\n  </device-transfer>\n</data-extraction-rules>\n`);
    return result;
  }]);
};
