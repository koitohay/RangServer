var express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
var sio = require('socket.io')(server);
var path = require('path');
// Import the Anagrammatix game file.
var rang = require('./ranggame');

app.use(express.static(path.join(__dirname, '/../public')));

// Socket.io
sio.on('connection', (socket) => {

    sio.on('readFromClient', (data) => {
        console.log(data);
    });

    //console.log('client connected');
    rang.initGame(sio, socket);

});

server.listen(4100, () => {
    console.log('Listening on :4100');
});

