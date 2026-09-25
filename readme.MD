# OpenUp Signaling Server

This is the repository for the OpenUp signaling server.

You can use this repository if you want to launch your own signaling server.

## Configuration

You can build and run the signaling server as is without further configuration. It will then run on port 3000.

You can change the port by setting the PORT environment variable.

### TURN
You can enable built-in TURN support by setting the following environment variables:
```
TURN_ENABLED=1
TURN_URL=turn:<your turn serverurl>:<your port>
TURN_SECRET=<your turn secret>
```

The signaling server will then create TURN credentials for the clients on their initial connect.
