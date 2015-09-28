var flightEventsUrl = '/sse'; // can also be full address
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

flightEvents.addEventListener('ping', function(e) { // specific message (has event field)
	var eventContent = {
		'lastEventId': e.lastEventId,
		'data': e.data,
		'origin': e.origin
	};
	console.log('ping: ' + JSON.stringify(eventContent));
}, false);
