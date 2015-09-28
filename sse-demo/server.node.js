var http = require('http');
var express = require('express');

var port = parseInt(process.argv[2]) || 8080;

if (port < 0) {
	console.log('Invalid port!');
	process.exit();
}

var app = express();
var httpServer = http.createServer(app);

app.get('/sse', function (req, res) {

	req.socket.setTimeout(Infinity); // request must last as long as possible

	console.log('Browser connection opened');

	// handle client connection close
	req.on('close', function() {
		console.log('Browser connection closed');
		res.end();
	});

	// send sse headers
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});
	res.write('\n');

	res.write('id: ' + 0 + '\n');
	res.write('event: ' + 'ping' + '\n');
	res.write('data: ' + 'boop' + '\n\n');

	res.write('id: ' + 1 + '\n');
	res.write('data: ' + JSON.stringify({ 'a': 1, 'b': [2,3], 'c': 3}) + '\n\n'); // Note the extra newline
});

app.use(express.static('./www'));

httpServer.listen(port, function () {
	console.log('Server running at http://localhost:%s/', port);
});
