var http = require('http');
var events = require('events');
var extend = require('util')._extend;

var sbs1 = require('sbs1');
var express = require('express');
var cache = require('memory-cache');

// ##### ##### ##### ##### ##### 
// ##### Helper Functions
// ##### ##### ##### ##### ##### 

function getIPAddress (req) {
	return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

function SSE (message) {
	/*
	INPUT
		message: {
			id: <int>, // REQUIRED
			retry: <int>, // optional
			event: <string>, // optional
			data: <string|object> // REQUIRED
		}
	OUTPUT
		<string>
	*/
	if (typeof message !== 'object') return;
	if (!message.id) return;
	if (!message.data) return;
	message.id = parseInt(message.id) || undefined;
	message.retry = parseInt(message.retry) || undefined;
	var buffer = [];
	if (0 <= message.id) {
		buffer.push('id: ' + message.id);
	}
	if (0 <= message.retry) {
		buffer.push('retry: ' + message.retry);
	}
	if (typeof message.event === 'string') {
		buffer.push('event: ' + message.event);
	}
	/*
	if (typeof message.data === 'string') { // broken
		message.data = message.data.replace(/(\r\n|\r|\n)/g, '\n');
		var dataLines = message.data.split(/\n/);
		for (var i = 0; i < dataLines.length; i++) {
			buffer.push('data: ' + dataLines[i]);
		}
	}
	else {
	*/
	if (typeof message.data === 'object') {
		buffer.push('data: ' + JSON.stringify(message.data));
	}
	var NEWLINE = '\n';
	buffer.push(NEWLINE);
	return buffer.join(NEWLINE);
}

function remap (f, mapping) {
	// remap({'A':1,'B':2,'C':3}, {'a':'A','b':'B','c':'C','d':'D','d':'C'}) => {'a':1,'b':2,'c':3,'d':3}
	var g = {};
	for (var z in mapping) {
		var x = mapping[z];
		if (x in f) {
			var y = f[x];
			g[z] = y;
		}
	}
	return g;
}

// ##### ##### ##### ##### ##### 
// ##### SSE Channel
// ##### ##### ##### ##### ##### 

var SSEChannel = new events.EventEmitter();

var FLIGHT_EXPIRE = 30*1000; // 30 seconds

var sbs1Client = sbs1.createClient({
	host: '192.168.1.23' // Set this to the SBS1 message address
});

SSEChannel.on('join', function (req, res) {

	// ##### Setup SSE

	console.log(getIPAddress(req) + ' - Browser connection opened');

	req.socket.setTimeout(0); // disabled existing timeout
	req.socket.setNoDelay(true); // send data off immediately

	// ##### Send SSE headers
	
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});

	res.write(':ok\n\n');

	// ##### Broadcast flight cache to new connections

	cache.keys().forEach(function(flightId) {
		var flightCache = cache.get(flightId);
		if (flightCache === null) return;
		res.write(SSE({
			'event': 'flight_add',
			'id': flightId,
			'data': flightCache
		}));
	});

	// ##### 

	var sbs1BoardcastListener = function (msg) {
		
		switch (msg.message_type) {
			
			case sbs1.MessageType.TRANSMISSION: { // information sent by aircraft

				var flightICACO = msg.hex_ident;
				if (!flightICACO) return;

				var flightId = parseInt(flightICACO, 16); // base 16 string to integer
				var flightDelta = null;

				switch (msg.transmission_type) {
					
					case sbs1.TransmissionType.ES_AIRBORNE_POS: {
						// extract only valid information and rename
						flightDelta = remap(msg, {
							'lat': 'lat',
							'lon': 'lon',
							'alt': 'altitude'
						});
					} break;

					case sbs1.TransmissionType.ES_AIRBORNE_VEL: {
						flightDelta = remap(msg, {
							'sx':	'ground_speed', // ground speed
							'sy':	'vertical_rate' // climb rate
						});
					} break;
				}

				if (flightDelta) {

					var flightEvent = 'flight_update';
					var flightCache = cache.get(flightId);

					if (flightCache === null) { // no prior knowledge
						flightEvent = 'flight_add';
						flightCache = {}
					}

					// extend flight cache with flight data, so that we can write this back into cache
					extend(flightCache, flightDelta);

					// debug information
					console.log(flightICACO + ' => ' + JSON.stringify(flightCache));

					// write into cache, setup automatic cleanup with timeout event
					cache.put(flightId, flightCache, FLIGHT_EXPIRE, function (flightId) {
						// send flight removed event
						res.write(SSE({
							'event': 'flight_remove',
							'id': flightId,
							'data': {} // No data to send
						}));
					});

					// send flight event
					res.write(SSE({
						'event': flightEvent,
						'id': flightId,
						'data': flightDelta // only send the data that actually changed
					}));
				}
			} break;
		}
	};

	// ##### Handle web browser closed connection
	
	req.on('close', function() {
		console.log(getIPAddress(req) + ' - Browser connection closed');
		sbs1Client.removeListener('message', sbs1BoardcastListener);
		res.end();
	});

	// ##### Handle SBS1 messages
	
	sbs1Client.addListener('message', sbs1BoardcastListener);
});

// ##### ##### ##### ##### ##### 
// ##### Server
// ##### ##### ##### ##### ##### 

var port = parseInt(process.argv[2]) || 8080;

if (port < 0) {
	console.log('Invalid port!');
	process.exit();
}

var httpApp = express();
var httpServer = http.createServer(httpApp);

httpApp.get('/flights', function (req, res) {
	SSEChannel.emit('join', req, res);
});

httpApp.use(express.static('./www'));

httpServer.listen(port, function () {
	console.log('Server running at http://127.0.0.1:%s/', port);
});
