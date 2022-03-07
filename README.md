<div align="center">
	<img src="img/logo.svg" alt="Indago"/>
	<br>
	<i>means 'track down' in Latin</i>
	<p>A very simple and lightweight visitor tracker middleware for Express.js servers.</p>
</div>

---

## Motivation

I needed an extremely simple way to visualize how many users visit my web apps, so I built this really simple drop-in middleware to do it. Platforms like gtag and segment can be overkill.


# Installation
```bash
# Install using npm
npm install indago --save
# or yarn
yarn add indago
```

## Usage
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

	// Path to save analytics data
	savePath: __dirname + '/analytics.json',

	// How fast the IPs should be cleared.
	// Should be the average session length. Defaults to 10 minutes
	clearIPsInterval: 10 * 60000,

	// This string is displayed next to the login prompt on some browsers.
	realm: 'example analytics',

	// Defaults to false for no dashboard route authentication
	authentication: {
		// Choose only one method of dashboard authentication:

		// 1. Username and Password
		username: 'root',
		password: 'securepassword123',
		// plaintext

		// 2. Base64 Authentication Header Code
		base64: 'cm9vdDpzZWN1cmVwYXNzd29yZDMxMg==',
		// atob('cm9vdDpzZWN1cmVwYXNzd29yZDMxMg==') === 'root:securepassword312'

		// 3. SHA256 Hash of Base64 Authentication Header Code
		hexHash: '68832558e77a2f66eb7703a4813b284fc49e086db75f232029ab269d0a494f55'
		// SHA256 Hash of 'cm9vdDpzZWN1cmVwYXNzd29yZDMxMg=='
	},

	// Called every 10 seconds
	onTick: async () => {
		if(Indago.Ticker('Update Image Folder Size', 10000)) { // Updates the image folder size property every 10 seconds
			analyticsTracker.update({
				imageFolderSize: await getImageFolderSize()
			});
		}
	},
	// Called when a request is made to the analytics dashboard route
	onDashboardRequest: (req, res) => {},
});

app.use('/_analytics', analyticsTracker.analyticsMW());

app.get('/', analyticsTracker.trackerMW(), (req, res) => {
	res.send("Hello!");
});

doSetupTask().then(async () => {
	await setupDatabaseOrSomethingSimilar();

	analyticsTracker.init();

	app.listen(3000, () => {
		console.log('listening on *:3000');
	});
}).catch(console.error);
```


## Dashboard

Then go to the route you've set to see the dashboard.

<img src="img/dashboard.png" alt="Indago Dashboard"/>