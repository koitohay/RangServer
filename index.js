var express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
var sio = require('socket.io')(server);
var path = require('path');
// Import the Anagrammatix game file.
var rang = require('./server/ranggame');

var numClients = 0;
var users = [{}];
app.use(express.static(path.join(__dirname, '/../public')));

// Socket.io
sio.on('connection', (socket) => {

    sio.on('readFromClient', (data)=>{
    console.log(data);
    });

    //console.log('client connected');
    rang.initGame(sio, socket);

    // Disconnect event
    socket.on('disconnect', function () {
        console.log('Client disconnected');
    });

});

server.listen(4100, () => {
    console.log('Listening on :4100');
});

