// ##### 

function dec2hex (x) {
	x = parseInt(x);
	if (x === 0) return '0';
	if (x) {
		return x.toString(16);
	}
	return undefined;
}

// ##### 

var Toronto = new google.maps.LatLng(43.6568774, -79.32085);

google.maps.event.addDomListener(window, 'load', function () {

	var map = new google.maps.Map(document.getElementById('map'), {
		zoom: 8,
		center: Toronto,
		mapTypeId: google.maps.MapTypeId.HYBRID
	});

	// ##### SSE

	var flightMarkers = {};
	var flightEventsUrl = '/flights'; // can also be full address
	var flightEvents = new EventSource(flightEventsUrl, { withCredentials: true });

	flightEvents.onopen = function () {
		console.log('connection opened');
	}

	flightEvents.onerror = function () {
		console.error('connection error');
	}

	flightEvents.addEventListener('flight_add', function(e) { // specific message (has event field)
		var flightId = ('' + e.lastEventId);
		var flightICACO = dec2hex(flightId);
		var flightData = JSON.parse(e.data);
		console.log('[' + flightICACO + ']' + ' - add - ' + JSON.stringify(flightData));
		// ...
		if (flightData.lat === undefined) return;
		if (flightData.lon === undefined) return;
		var flightPosition = new google.maps.LatLng(flightData.lat, flightData.lon);
		// ...
		var infowindow = new google.maps.InfoWindow({
			content: 'icaco: ' + flightICACO
		});
		var marker = new google.maps.Marker({
			map: map,
			position: flightPosition
		});
		google.maps.event.addListener(marker, 'click', function() {
			infowindow.open(map, marker);
		});
		flightMarkers[flightId] = marker;
	});

	flightEvents.addEventListener('flight_update', function(e) {
		var flightId = ('' + e.lastEventId);
		var flightICACO = dec2hex(flightId);
		var flightData = JSON.parse(e.data);
		console.log('[' + flightICACO + ']' + ' - update - ' + JSON.stringify(flightData));
		// ...
		if (flightData.lat === undefined) return;
		if (flightData.lon === undefined) return;
		var flightPosition = new google.maps.LatLng(flightData.lat, flightData.lon);
		// ...
		flightMarkers[flightId].setPosition(flightPosition); // TODO: sometimes the marker does not exist, find out why
	});

	flightEvents.addEventListener('flight_remove', function(e) {
		var flightId = ('' + e.lastEventId);
		var flightICACO = dec2hex(flightId);
		var flightData = JSON.parse(e.data);
		console.log('[' + flightICACO + ']' + ' - remove - ' + JSON.stringify(flightData));
		// ...
		flightMarkers[flightId].setMap(null); // TODO: sometimes the marker does not exist, find out why
		delete flightMarkers[flightId];
	});
});
