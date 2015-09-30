var flightEventsUrl = '/flights'; // can also be full address
var flightEvents = new EventSource(flightEventsUrl, { withCredentials: true });

flightEvents.onopen = function () {
	console.log('connection opened');
}

flightEvents.onerror = function () {
	console.error('connection error');
}

flightEvents.onmessage = function (e) { // generic message (has no event field)
	var eventContent = {
		'lastEventId': e.lastEventId,
		'data': e.data,
		'origin': e.origin
	};
	console.log('generic message: ' + JSON.stringify(eventContent));
}

function dec2hex (x) {
	x = parseInt(x);
	if (x === 0) return '0';
	if (x) {
		return x.toString(16);
	}
	return undefined;
}

flightEvents.addEventListener('position', function(e) { // specific message (has event field)
	var flightICACO = dec2hex(e.lastEventId);
	var flightData = JSON.parse(e.data);
	console.log('[' + flightICACO + ']' + ' - position - ' + JSON.stringify(flightData));
}, false);

flightEvents.addEventListener('speed', function(e) { // specific message (has event field)
	var flightICACO = dec2hex(e.lastEventId);
	var flightData = JSON.parse(e.data);
	console.log('[' + flightICACO + ']' + ' - speed - ' + JSON.stringify(flightData));
}, false);
