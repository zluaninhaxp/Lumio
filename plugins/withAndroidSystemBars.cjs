const fs = require('node:fs');
const { withAndroidStyles, withMainActivity, AndroidConfig } = require('expo/config-plugins');

const MARKER = '// Lumio: inherit system-bar policy in the separate Modal window.';
function configureModalSystemBars(source, version) {
  if (version !== '0.81.5') throw new Error(`Review Lumio's Modal system-bars fix before upgrading React Native (${version}).`);
  if (source.includes(MARKER)) return source;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  if (source.includes('override fun onWindowFocusChanged')) throw new Error('MainActivity already handles window focus; merge the Lumio system-bar policy explicitly.');
  const end = source.lastIndexOf('}');
  if (end < 0 || !source.includes('class MainActivity')) throw new Error('Unexpected MainActivity Kotlin source.');
  // Configure the generated app Activity, not RN sources: Android normally uses
  // a precompiled react-android AAR, so patching its .kt files would not work.
  const addition = [
    '', `  ${MARKER}`,
    '  private val lumioModalFocusObservers = java.util.WeakHashMap<android.view.View, android.view.ViewTreeObserver.OnWindowFocusChangeListener>()',
    '  override fun onWindowFocusChanged(hasFocus: Boolean) {',
    '    super.onWindowFocusChanged(hasFocus)',
    '    // Dialog.show and RN initialization complete before this posted task.',
    '    window.decorView.post { syncLumioModalSystemBars(window.decorView) }',
    '  }',
    '',
    '  private fun syncLumioModalSystemBars(view: android.view.View?) {',
    '    if (view == null) return',
    '    if (view is com.facebook.react.views.modal.ReactModalHostView) {',
    '      view.dialog?.takeIf { it.isShowing }?.window?.let { modalWindow ->',
    '        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {',
    '          modalWindow.isNavigationBarContrastEnforced = window.isNavigationBarContrastEnforced',
    '        }',
    '        val activityController = androidx.core.view.WindowInsetsControllerCompat(window, window.decorView)',
    '        val modalController = androidx.core.view.WindowInsetsControllerCompat(modalWindow, modalWindow.decorView)',
    '        modalController.isAppearanceLightNavigationBars = activityController.isAppearanceLightNavigationBars',
    '        val decor = modalWindow.decorView',
    '        if (!lumioModalFocusObservers.containsKey(decor)) {',
    '          val listener = android.view.ViewTreeObserver.OnWindowFocusChangeListener {',
    '            window.decorView.post { syncLumioModalSystemBars(window.decorView) }',
    '          }',
    '          lumioModalFocusObservers[decor] = listener',
    '          decor.viewTreeObserver.addOnWindowFocusChangeListener(listener)',
    '        }',
    '      }',
    '    }',
    '    if (view is android.view.ViewGroup) {',
    '      for (index in 0 until view.childCount) syncLumioModalSystemBars(view.getChildAt(index))',
    '    }',
    '  }',
    '',
  ].join(newline);
  return source.slice(0, end) + addition + source.slice(end);
}

function withAndroidSystemBars(config) {
  config = withAndroidStyles(config, config => {
    for (const [name, value] of [
      ['android:enforceNavigationBarContrast', 'false'],
      ['android:enforceStatusBarContrast', 'false'],
      ['android:windowLightNavigationBar', 'true'],
      ['android:windowLightStatusBar', 'true'],
    ]) {
      config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
        add: true, parent: AndroidConfig.Styles.getAppThemeGroup(), name, value,
      });
    }
    return config;
  });
  return withMainActivity(config, config => {
    const packageFile = require.resolve('react-native/package.json', { paths: [config.modRequest.projectRoot] });
    const version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
    if (config.modResults.language !== 'kt') throw new Error('Lumio system-bars plugin requires a Kotlin MainActivity.');
    config.modResults.contents = configureModalSystemBars(config.modResults.contents, version);
    return config;
  });
}
module.exports = withAndroidSystemBars;
module.exports.configureModalSystemBars = configureModalSystemBars;
