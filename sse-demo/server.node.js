var http = require('http');
var events = require('events');

var sbs1 = require('sbs1');
var redis = require('redis');
var express = require('express');

function sse (message) {
	/*
	 {
	  retry: <int>,
	  id: <int>,
	  event: <string>,
	  data: <string|object>
	 }
	*/
	if (typeof message !== 'object') return;
	if (!message.data) return;
	message.retry = parseInt(message.retry) || undefined;
	message.id = parseInt(message.id) || undefined;
	var buffer = [];
	if (0 <= message.retry) {
		buffer.push('retry: ' + message.retry);
	}
	if (0 <= message.id) {
		buffer.push('id: ' + message.id);
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

// ##### ##### ##### ##### ##### 
// ##### Server
// ##### ##### ##### ##### ##### 

var port = parseInt(process.argv[2]) || 8080;

if (port < 0) {
	console.log('Invalid port!');
	process.exit();
}

var app = express();
var httpServer = http.createServer(app);
var channel = new events.EventEmitter();

var sbs1Client = sbs1.createClient({
	host: '192.168.1.23'
});

/* WORKING EXAMPLE
channel.on('broadcast', function (req, res) {
	sbs1Client.on('message', function (msg) {
		
		if (msg.message_type !== sbs1.MessageType.TRANSMISSION) return;
		if (msg.transmission_type !== sbs1.TransmissionType.ES_AIRBORNE_POS) return;

		var icaco = msg.hex_ident;
		if (!icaco) return;

		var flightId = parseInt(icaco, 16);

		res.write(sse({
			'id': flightId,
			'event': 'update',
			'data': { time: msg.generated_time }
		}));
	});
});
*/

channel.on('broadcast', function (req, res) {
	sbs1Client.on('message', function (msg) {
		switch (msg.message_type) {
			case sbs1.MessageType.TRANSMISSION: { // information sent by aircraft

				var icaco = msg.hex_ident;
				if (!icaco) return;

				var flightId = parseInt(icaco, 16);

				switch (msg.transmission_type) {
					case sbs1.TransmissionType.ES_AIRBORNE_POS: {
						res.write(sse({
							'id': flightId,
							'event': 'position',
							'data': {
								'date': msg.generated_date,
								'time': msg.generated_time,
								'lat': msg.lat,
								'lon': msg.lon,
								'alt': msg.altitude
							}
						}));
					} break;
					case sbs1.TransmissionType.ES_AIRBORNE_VEL: {
						res.write(sse({
							'id': flightId,
							'event': 'speed',
							'data': {
								'date': msg.generated_date,
								'time': msg.generated_time,
								'x': msg.ground_speed, // ground speed / horizontal speed
								'y': msg.vertical_rate // rate of climb / vertical speed
							}
						}));
					} break;
				}
			} break;
		}
	});
});

app.get('/flights', function (req, res) {

	console.log('Browser connection opened');

	req.socket.setTimeout(0); // disabled existing timeout
	req.socket.setNoDelay(true); // send data off immediately

	// handle client connection close
	req.on('close', function() {
		console.log('Browser connection closed');
		//sbs1Client.removeListener('message', sbs1Listener(req, res));
		res.end();
	});

	// send sse headers
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});
	res.write(':ok\n\n');

	channel.emit('broadcast', req, res);
});

app.use(express.static('./www'));

httpServer.listen(port, function () {
	console.log('Server running at http://127.0.0.1:%s/', port);
});
