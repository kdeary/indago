const crypto = require('crypto');
const { getClientIp } = require('./vendor/request-ip');
const fsp = require('fs').promises;

const ANALYTICS_TEMPLATE = {
	"$visits/": {},
	lastSuccessfulDebugAccesses: [],
	lastUnsuccessfulDebugAccesses: [],
};

const TICKER_TRACKERS = {};

const log_error = (...args) => console.error("INDAGO ERROR:\n", ...args);

const DEBUG_ACCESS_PROPERTY_DEBOUNCE = 3 * 60000;

class Tracker {
	constructor({
		template,
		savePath,
		clearIPsInterval,
		authentication,
		realm,
		onInit,
		onTick,
		onDashboardRequest
	}) {
		this.template = template || {};
		this.savePath = savePath || __dirname + '/analytics.json';
		this.authentication = authentication || false;
		this.realm = realm || 'Indago Analytics';
		this.clearIPsInterval = clearIPsInterval ||  10 * 60000;

		this.analytics = {
			...ANALYTICS_TEMPLATE,
			...this.template
		};
		this.countedIPs = {};
		this.didAnalyticsUpdate = false;
		this.tickInterval = null;
		this.ready = false;

		this.onTick = onTick || (() => {});
		this.onDashboardRequest = onDashboardRequest || (() => {});
		this.visualHTMLTemplate = "";

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
				const saveStr = JSON.stringify(this.update());
				await fsp.writeFile(this.savePath, saveStr).catch(err => {
					log_error("Error creating new analytics file", err);
				});

				return saveStr;
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

			if(Ticker('Clear Counted IPs', this.clearIPsInterval)) {
				this.countedIPs = {};
			}

			this.onTick();
		}, 10000);

		this.visualHTMLTemplate = (await fsp.readFile(__dirname + '/visual.html')).toString();

		this.ready = true;
	}

	destroy() {
		clearInterval(this.tickInterval);
	}

	analyticsMW() {
		return (req, res, next) => {
			if(!this.ready) return next();

			req._indagoIP = getClientIp(req.ip) || req.ip;

			const isAuthenticated = this.isAuthenticated(req);

			if(!isAuthenticated) {
				res.set('WWW-Authenticate', `Basic realm="${this.realm}"`) // change this
				res.status(401).send('Authentication required.') // custom message

				if(isAuthenticated === false) {
					this.triggerDebugAccess('lastUnsuccessfulDebugAccesses', req);
				}

				return;
			}

			this.onDashboardRequest(req, res);

			if(req.path === '/analytics.json') {
				return res.json(this.analytics);
			}

			this.triggerDebugAccess('lastSuccessfulDebugAccesses', req);

			return res.send(this.visualHTMLTemplate.replace(
				'<%%% ANALYTICS %%%>',
				`<script>window.ANALYTICS = ${JSON.stringify(this.analytics)};</script>`
			));
		};
	}

	trackerMW() {
		return (req, res, next) => {
			req._indagoIP = getClientIp(req.ip) || req.ip;

			this.recordVisit(req._indagoIP, "$visits" + req.path);
			next();
		};
	}

	triggerDebugAccess(debugAccessesID, req) {
		if(
			!this.analytics[debugAccessesID][0] ||
			this.analytics[debugAccessesID][0].ip !== req._indagoIP ||
			Date.now() - new Date(this.analytics[debugAccessesID][0]) > DEBUG_ACCESS_PROPERTY_DEBOUNCE
		) {
			this.analytics[debugAccessesID].unshift({
				date: new Date().toLocaleString(),
				ip: req._indagoIP
			});
			this.analytics[debugAccessesID] = this.analytics[debugAccessesID].slice(0, 5);

			this.update();
		}
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

	recordVisit(ip, prop="$visits") {
		const todaysDate = (new Date()).toLocaleDateString();

		if(!this.analytics[prop]) this.analytics[prop] = {};

		if(this.countedIPs[ip]) return this.analytics[prop][todaysDate];
		this.countedIPs[ip] = true;

		if(!this.analytics[prop][todaysDate]) {
			this.analytics[prop][todaysDate] = 0;
		}

		this.analytics[prop][todaysDate]++;

		this.update();

		return this.analytics[prop][todaysDate];
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