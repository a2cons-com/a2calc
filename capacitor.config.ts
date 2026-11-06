import type { CapacitorConfig } from '@capacitor/cli';
import appConfig from './config/app.json' with { type: 'json' };

// App identity comes from config/app.json (scripts/gen-config.mjs writes
// the same values into the Xcode project).
const config: CapacitorConfig = {
	appId: appConfig.appId,
	appName: appConfig.appName,
	webDir: 'build',
	ios: {
		// Swift Package Manager, not CocoaPods.
		scheme: 'App',
		// The page pads itself with env(safe-area-inset-*).
		contentInset: 'never',
		backgroundColor: '#f2f5f3'
	},
	plugins: {
		SplashScreen: {
			launchShowDuration: 0,
			launchAutoHide: false,
			backgroundColor: '#f2f5f3'
		}
	}
};

export default config;
