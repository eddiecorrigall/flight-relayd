= Local NooElec Setup =

dump1090 --net --net-sbs-port 30003 --interactive --enable-agc
nodejs server.node.js 127.0.0.1 30003
x-www-browser http://127.0.0.1:8181
