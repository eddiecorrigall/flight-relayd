# Local NooElec Setup

```
# Run dump1090 with sbs1 messages on port 30003
> dump1090 --net --net-sbs-port 30003 --interactive --enable-agc
# Run server connecting to local sbs1 server on port 30003
> nodejs server.node.js 127.0.0.1 30003
# Launch a web browser opening the flight interface
> x-www-browser http://127.0.0.1:8181
```
