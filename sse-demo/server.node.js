var http = require('http');
var events = require('events');

var sbs1 = require('sbs1');
var express = require('express');

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
// ##### Server
// ##### ##### ##### ##### ##### 

var port = parseInt(process.argv[2]) || 8080;

if (port < 0) {
	console.log('Invalid port!');
	process.exit();
}

var sbs1Client = sbs1.createClient({
	host: '192.168.1.23'
});

var SSEChannel = new events.EventEmitter();

SSEChannel.on('join', function (req, res) {

	var sbs1BoardcastListener = function (msg) {
		switch (msg.message_type) {
			case sbs1.MessageType.TRANSMISSION: { // information sent by aircraft

				var icaco = msg.hex_ident;
				if (!icaco) return;

				var flightId = parseInt(icaco, 16);

				switch (msg.transmission_type) {
					case sbs1.TransmissionType.ES_AIRBORNE_POS: {
						var flightData = remap(msg, {
							'date':	'generated_date',
							'time':	'generated_time',
							'lat':	'lat',
							'lon':	'lon',
							'alt':	'altitude'
						});
						res.write(SSE({
							'event': 'position',
							'id': flightId,
							'data': flightData
						}));
					} break;
					case sbs1.TransmissionType.ES_AIRBORNE_VEL: {
						var flightData = remap(msg, {
							'date':	'generated_date',
							'time':	'generated_time',
							'sx':	'ground_speed', // ground speed
							'sy':	'vertical_rate' // climb rate
						});
						res.write(SSE({
							'event': 'speed',
							'id': flightId,
							'data': flightData
						}));
					} break;
				}
			} break;
		}
	};

	// handle web browser closed connection
	req.on('close', function() {
		console.log('Browser connection closed');
		sbs1Client.removeListener('message', sbs1BoardcastListener);
		res.end();
	});

	// handle sbs1 messages
	sbs1Client.addListener('message', sbs1BoardcastListener);
});

var httpApp = express();
var httpServer = http.createServer(httpApp);

httpApp.get('/flights', function (req, res) {

	console.log('Browser connection opened');

	req.socket.setTimeout(0); // disabled existing timeout
	req.socket.setNoDelay(true); // send data off immediately

	// send sse headers
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});
	res.write(':ok\n\n');

	SSEChannel.emit('join', req, res);
});

httpApp.use(express.static('./www'));

httpServer.listen(port, function () {
	console.log('Server running at http://127.0.0.1:%s/', port);
});
