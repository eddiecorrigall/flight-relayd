var _ = require('lodash');
var fs = require('fs');
//var crypto = require('crypto');
var http = require('http');
var sbs1 = require('sbs1');

var NodeCache = require('node-cache');
var SSEServices = require('sse-services').Services;

// RUN: nodejs server.node.js <sbs1 host address>

// ##### ##### ##### ##### ##### 

require('sse-services').debug = true;

var httpServer = null;
var httpPort = null;

/*
var privateKey = fs.readFileSync('privatekey.pem').toString();
var certificate = fs.readFileSync('certificate.pem').toString();
var credentials = crypto.createCredentials({ key: privateKey, cert: certificate });
// ...
httpServer.setSecure(credentials);
*/

var cache = new NodeCache({ stdTTL: 60, checkperiod: 0.1 }); // Expire after 60 seconds, check every 0.1 seconds
var sseServices = new SSEServices(httpPort, httpServer);

sseServices.on('stop', function () {
	cache.flushAll();
	cache.close();
});

sseServices.on('start', function () {
	console.log('HTTP Server','http://127.0.0.1' + ':' + sseServices.httpPort);
	// ...
	sseServices.sseChannel.on('join', function (pm) {
		// Send new peer a complete itinerary of cache
		console.log('initial broadcast >>>');
		cache.keys().forEach(function (key) {
			var eventId = 0; // Unsure what this value should be yet
			var eventData = cache.get(key);
			if (eventData === undefined) return;
			pm('set', eventId, eventData); // Send private message to peer
		});
		console.log('<<<');
	});
	// ...
	cache.on('del', function (key, value) {
		var eventId = 0; // Unsure what this value should be yet
		var eventData = value;
		sseServices.sseChannel.emit('broadcast', 'del', eventId, eventData);
	});
	cache.on('set', function (key, value) {
		var eventId = 0; // Unsure what this value should be yet
		var eventData = value;
		sseServices.sseChannel.emit('broadcast', 'set', eventId, eventData);
	});
});

// ##### ##### ##### ##### ##### 

var sbs1Host = process.argv[2] || '127.0.0.1';
var sbs1Port = process.argv[3] || 30003;
var sbs1Client = sbs1.createClient({ host: sbs1Host, port: sbs1Port }); // Listens to the SBS1 message server
var sbs1LastMessage = undefined;

sbs1Client.on('message', function (sbs1Message) {
	switch (sbs1Message.message_type) {
		case sbs1.MessageType.TRANSMISSION: { // Information sent by aircraft

			if (_.isEqual(sbs1LastMessage, sbs1Message)) return;
			sbs1LastMessage = sbs1Message;
			
			var flightICACO = sbs1Message.hex_ident;
			if (!flightICACO) return;
			
			//var flightMessageTimestamp = new Date(sbs1Message.generated_date + ' ' + sbs1Message.generated_time);
			var flightMessageTimestamp = new Date(sbs1Message.logged_date + ' ' + sbs1Message.logged_time);
			//flightMessageTimestamp = flightMessageTimestamp.getTime();
			var flightInCache = cache.get(flightICACO);

			if (flightInCache !== undefined) {
				if (flightMessageTimestamp <= flightInCache.timestamp) return;
			}
			else {
				flightInCache = {};
			}

			flightInCache.icaco = flightICACO;
			flightInCache.ts = flightMessageTimestamp;

			switch (sbs1Message.transmission_type) {
				case sbs1.TransmissionType.ES_AIRBORNE_POS: {
					flightInCache.lat = sbs1Message.lat;
					flightInCache.lon = sbs1Message.lon;
					flightInCache.alt = sbs1Message.altitude;
				} break;
				case sbs1.TransmissionType.ES_AIRBORNE_VEL: {
					flightInCache.sx = sbs1Message.ground_speed; // ground rate
					flightInCache.sy = sbs1Message.vertical_rate; // climb rate
				} break;
				default: { return; } break;
			}

			cache.set(flightICACO, flightInCache);

		} break;
	}
});
