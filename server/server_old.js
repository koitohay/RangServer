var express = require('express');
var app = require('express')();
var server = require('http').createServer(app);
var sio = require('socket.io')(server);
var path = require('path');

var numClients = 0;
var users = [{}];
app.use(express.static(path.join(__dirname, '/../public')));

// Socket.io
sio.on('connection', (socket) => {

    numClients++;
    sio.emit('stats', { numClients: numClients });
    // Store socket ID
    var socketID = socket.conn.id;

    // Log connection
    // console.log('Connection:', socketID);

    // Ping event
    socket.on('ping', (message) => {
        console.log('Ping:', socketID, '-', (message || '(no message>'));
    });

    interval = setInterval(() => getApiAndEmit(socket), 1000);
    const getApiAndEmit = socket => {
        const response = new Date();
        // Emitting a new message. Will be consumed by the client
        socket.emit("FromAPI", response);
      };

      socket.on('joinRoom', (roomID, user) => {

        if(rooms.find(roomID).length > 0)
            socket.join(roomID);
            else
            socket.createRoom('');
            var player1= true;

console.log("loggedin")
      });
    // // Ping event
    // socket.on('joinRoom', (roomID, user) => {
    //     if (numClients < 5) {
    //         users.push({name:user, room:roomID});
    //         socket.join(roomID);
    //         console.log('Joined in room:', roomID);
    //         console.log('users joined in room:', users);
    //         sio.to(roomID).emit("roomJoined", roomID);

    //         if(numberOfUsersInRoom(roomID) == 4)
    //         {
    //             sio.to(roomID).emit("GameStarted", roomID);
    //         }
    //     } 
    //     else {
    //         console.log('Max of 4 can join a room:', roomID);
    //     }
    // });

    // console.log('Connected clients:', numClients);

    // Disconnect event
    socket.on('disconnect', function () {
        numClients--;
        sio.emit('stats', { numClients: numClients });
        clearInterval(interval);
        console.log('Connected clients:', numClients);
    });

});

server.listen(4100, () => {
    console.log('Listening on :4100');
});

function numberOfUsersInRoom(roomID){
return users.filter((obj) => obj.room === roomID).length;
}