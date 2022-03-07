const http = require('http');
const express = require('express');
const Indago = require('./index.js');

const app = express();

const analyticsTracker = new Indago.Tracker({
	template: {
		// Custom analytics properties
		imageFolderSize: 0 // Example property
	},
	savePath: __dirname + '/analytics.json', // Path to save analytics data
	clearIPsInterval: 10 * 60000,
	realm: 'example analytics', // This string is displayed next to the login prompt on some browsers.
	authentication: { // Defaults to false for no dashboard route authentication
		// Choose only one method of dashboard authentication:
		// 1. Username and Password
		username: 'root',
		password: 'securepassword123',

		// 2. Base64 Authentication Header Code
		// base64: 'cm9vdDpzZWN1cmVwYXNzd29yZDMxMg==',
		// // atob('cm9vdDpzZWN1cmVwYXNzd29yZDMxMg==') === 'root:securepassword312'

		// 3. SHA256 Hash of Base64 Authentication Header Code
		// hexHash: '68832558e77a2f66eb7703a4813b284fc49e086db75f232029ab269d0a494f55'
		// // SHA256 Hash of 'cm9vdDpzZWN1cmVwYXNzd29yZDMxMg=='
	},
	// Called every 10 seconds
	onTick: async () => {
		if(Indago.Ticker('Update Image Folder Size', 10000)) { // Updates the image folder size every 5 minutes
			analyticsTracker.update({
				imageFolderSize: await getImageFolderSize()
			});
		}
	},
	// Called when a request is made to the debug route
	onDebugRequest: (req, res) => {},
});

app.use('/_analytics', analyticsTracker.analyticsMW());

app.get('/', analyticsTracker.trackerMW(), (req, res) => {
	res.send("Hello!");
});

function doSetupTask() {
	return new Promise(resolve => {
		console.log("Setting up server...");
		setTimeout(resolve, 1000);
	});
}

function setupDatabaseOrSomethingSimilar() {
	return new Promise(resolve => {
		console.log("Setting up database...");
		setTimeout(resolve, 1000);
	});
}

function getImageFolderSize() {
	return new Promise(resolve => {
		console.log("Getting folder size...");
		setTimeout(() => {
			resolve(Math.floor(Math.random() * 1000));
		}, 1000);
	});
};

doSetupTask().then(async () => {
	await setupDatabaseOrSomethingSimilar();

	analyticsTracker.init();

	app.listen(3000, () => {
		console.log('listening on *:3000');
	});
}).catch(console.error);