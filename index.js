const crypto = require('crypto');
const fsp = require('fs').promises;

const ANALYTICS_TEMPLATE = {
	visits: {},
	lastSuccessfulDebugAccesses: [],
	lastUnsuccessfulDebugAccesses: [],
};

const TICKER_TRACKERS = {

};

const log_error = (...args) => console.error("INDAGO ERROR:\n", ...args);

class Tracker {
	constructor({
		template,
		savePath,
		analyticsRoute,
		authentication,
		onInit,
		onTick,
		onDebugRequest
	}) {
		this.template = template || {};
		this.analyticsRoute = analyticsRoute || '/_debug';
		this.savePath = savePath || __dirname + '/analytics.json';
		this.authentication = authentication || false;

		this.analytics = {
			...ANALYTICS_TEMPLATE,
			...this.template
		};
		this.countedIPs = {};
		this.didAnalyticsUpdate = false;
		this.tickInterval = null;
		this.ready = false;

		this.onTick = onTick || (() => {});
		this.onDebugRequest = onDebugRequest || (() => {});

		this.isAuthenticated = req => {
			if(this.authentication) {
				const b64Code = (req.headers.authorization || '').split(' ')[1] || '';

				if(!b64Code) return null;

				const hash = crypto.createHash('sha256').update(b64Code).digest('hex');
				const [_, username, password] = Buffer.from(b64Code, 'base64').toString().match(/(.*?):(.*)/) || []

				if(this.authentication.base64 && b64Code === this.authentication.base64) return true;
				if(this.authentication.hexHash && hash === this.authentication.hexHash) return true;
				if(
					this.authentication.username && this.authentication.password &&
					username === this.authentication.username && password === this.authentication.password
				) return true;

				return false;
			} else {
				return true;
			}
		};
	}

	async init() {
		const json = await fsp.readFile(this.savePath).catch(async (err) => {
			if(err.code === 'ENOENT') {
				await fsp.writeFile(this.savePath, JSON.stringify(
					this.update()
				)).catch(err => {
					log_error("Error creating new analytics file", err);
				});

				return ANALYTICS_TEMPLATE;
			} else {
				log_error(err);
			}
		});

		try {
			this.analytics = JSON.parse(json);
		} catch(e) {
			log_error("Couldn't parse json", e);
			this.analytics = ANALYTICS_TEMPLATE;
		}

		this.tickInterval = setInterval(() => {
			if(this.didAnalyticsUpdate) {
				fsp.writeFile(this.savePath, JSON.stringify({
					...ANALYTICS_TEMPLATE,
					...this.defaultAnalytics,
					...this.analytics
				})).catch(err => {
					log_error("Error updating analytics file", err);
				});
				this.didAnalyticsUpdate = false;
			}

			if(Ticker('Clear Counted IPs', 10 * 60000)) {
				this.countedIPs = {};
			}

			this.onTick();
		}, 10000);

		this.ready = true;
	}

	destroy() {
		clearInterval(this.tickInterval);
	}

	middleware() {
		return (req, res, next) => {
			if(!this.ready) return next();

			if(req.path.startsWith(this.analyticsRoute)) {
				this.onDebugRequest(req, res);

				const isAuthenticated = this.isAuthenticated(req);

				if(!isAuthenticated) {
					res.set('WWW-Authenticate', 'Basic realm="analytics"') // change this
					res.status(401).send('Authentication required.') // custom message

					if(isAuthenticated === false) {
						this.update(obj => ({
							lastUnsuccessfulDebugAccesses: [
								{
									date: new Date().toLocaleString(),
									ip: req.ip
								},
								...obj.lastUnsuccessfulDebugAccesses
							].slice(0, 5)
						}));
					}

					return;
				}

				if(req.path === this.analyticsRoute + '/analytics.js') {
					res.set('Content-Type', 'text/javascript');
					res.send(`window.ANALYTICS = ${JSON.stringify(this.analytics)};`);
					return res.end();
				} else if(req.path === this.analyticsRoute + '/analytics.json') {
					return res.json(this.analytics);
				}

				this.update(obj => ({
					lastSuccessfulDebugAccesses: [
						{
							date: new Date().toLocaleString(),
							ip: req.ip
						},
						...obj.lastSuccessfulDebugAccesses
					].slice(0, 5)
				}));

				return res.sendFile(__dirname + '/visual.html');
			}

			this.recordVisit(req.ip);
			return next();
		};
	}

	update(newAnalytics={}) {
		let currentAnalytics = {
			...ANALYTICS_TEMPLATE,
			...this.defaultAnalytics,
			...this.analytics
		};

		this.didAnalyticsUpdate = true;

		return this.analytics = {
			...currentAnalytics,
			...(typeof newAnalytics === "function" ? newAnalytics(currentAnalytics) : newAnalytics)
		};
	}

	recordVisit(ip) {
		const todaysDate = (new Date()).toLocaleDateString();

		if(this.countedIPs[ip]) return this.analytics.visits[todaysDate];
		this.countedIPs[ip] = true;

		if(!this.analytics.visits[todaysDate]) {
			this.analytics.visits[todaysDate] = 0;
		}

		this.analytics.visits[todaysDate]++;

		this.update();

		return this.analytics.visits[todaysDate];
	}
}

function Ticker(id, time) {
	if(typeof TICKER_TRACKERS[id] === 'undefined') {
		TICKER_TRACKERS[id] = Date.now();
		return false;
	}

	if(Date.now() - TICKER_TRACKERS[id] > time) {
		TICKER_TRACKERS[id] = Date.now();
		return true;
	}

	return false;
}

module.exports = {
	Tracker,
	Ticker
};