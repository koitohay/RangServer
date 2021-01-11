 // Socket.io
 var sio = io();

 // Connection event
 sio.on('connect', () => {
     console.log('Connected');

     sio.emit('ping', 'on connect');
     sio.emit('joinRoom', 'A1234', 'Kaleem');
 });

 sio.on('roomJoined', (roomID) => {
    console.log("joined room", roomID);
});

sio.on('startGame', (data) => {
    console.log("Game Started", data.gameId);
    
});

// Error event
sio.on('stats', (e) => {
    console.log(e);
});
//  // Tick event
//  sio.on('tick', (time) => {
//      console.log('Tick', time);
//  });

 // Error event
 sio.on('error', (e) => {
     console.error(e);
 });
