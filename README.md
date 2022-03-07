# indago

Indago is a very simple visitor tracker middleware for Express.js servers.

```bash
# Install using npm
npm install indago --save
# or yarn
yarn add indago
```

## Example
```js
const http = require('http');
const express = require('express');
const Indago = require('indago');

const app = express();

const analyticsTracker = new Indago.Tracker({
	template: {
		// Custom analytics properties
		imageFolderSize: 0 // Example property
	},
	analyticsRoute: '/_debug', // Route to expose the analytics dashboard on.
	savePath: __dirname + '/analytics.json', // Path to save analytics data
	authentication: { // Defaults to false for no dashboard route authentication
		// Choose only one method of dashboard authentication:
		// 1. Username and Password
		username: 'root',
		password: 'securepassword123',

		// 2. Base64 Authentication Header Code
		base64: 'cm9vdDpzZWN1cmVwYXNzd29yZDMxMg==' // atob('cm9vdDpzZWN1cmVwYXNzd29yZDMxMg==') === 'root:securepassword312'

		// 3. SHA256 Hash of Base64 Authentication Header Code
		hexHash: '68832558e77a2f66eb7703a4813b284fc49e086db75f232029ab269d0a494f55' // SHA256 Hash of 'cm9vdDpzZWN1cmVwYXNzd29yZDMxMg=='
	},
	// Called every 10 seconds
	onTick: async () => {
		if(Indago.Ticker('Update Image Folder Size', 5 * 60000)) { // Updates the image folder size every 5 minutes
			analyticsTracker.update({
				imageFolderSize: await getImageFolderSize()
			});
		}
	},
	// Called when a request is made to the debug route
	onDebugRequest: (req, res) => {},
});

app.use('/', analyticsTracker.middleware());

doSetupTask().then(async () => {
	await setupDatabaseOrSomethingSimilar();

	analyticsTracker.init();

	app.listen(3000, () => {
		console.log('listening on *:3000');
	});
}).catch(console.error);
```