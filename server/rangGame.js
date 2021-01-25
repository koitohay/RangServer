const { reset } = require("nodemon");

var io;
var gameSocket;
// declare card elements
const suits = ["spades", "diamonds", "clubs", "hearts"];

// empty array to contain cards
var deck = null;
let players = [];
let playedCards = [];
let rangSet = 0;
var rooms = [];
/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function (sio, socket) {
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('dealCardsToPlayers', dealCardsToPlayers);
    gameSocket.on('playedCard', playedCard);
    gameSocket.on('getCardForRangSelection', getCardForRangSelection);
    gameSocket.on('gameEnded', gameEnded);

    // Disconnect event
    gameSocket.on('disconnect', function () {
        console.log('Client disconnected');
        logoutPlayer();
    });

}

function logoutPlayer() {
    console.log("Socket Id: ", gameSocket.id);

    var player = players.find((obj) => obj.socketId === gameSocket.id);

    var indexOfplayer = players.indexOf(player);
    if (indexOfplayer != -1) {
        players.slice(indexOfplayer, 1);
        gameEnded({gameId: player.room})
        console.log("player logged out: ", player);
    }
}

function gameEnded(data) {
    console.log("Game ended called: ", data);

    io.to(data.gameId).emit("gameEnded", { gameId: data.gameId });

    var room = rooms.find((room) => room.roomId === data.gameId);

    var indexOfRoom = rooms.indexOf(room);
    if (indexOfRoom != -1)
        rooms.slice(indexOfRoom, 1);
}


/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
function hostCreateNewGame(data) {
    // Create a unique Socket.IO Room
    var thisGameId = (Math.random() * 100000) | 0;

    players.push(createPlayer(data.playerName, thisGameId, 1, this.id, false, true));

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', { gameId: thisGameId, mySocketId: this.id, isHost: true, players: numberOfUsersInRoom(thisGameId.toString()) });


    // Join the Room and wait for the players
    this.join(thisGameId.toString());

    //console.log(io.sockets.adapter.rooms);
};

/*
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(data) {
    var sock = this;
    deck = new Deck();
    var data = {
        mySocketId: sock.id,
        gameId: data.gameId
    };

    //console.log("All Players Present. Preparing game...", data.gameId, players);
    io.to(data.gameId).emit('beginNewGame', data);
}


/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */


/**
 * A player clicked the 'JOIN GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {/*  */
    //console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    console.log(data.gameId);

    // Look up the room ID in the Socket.IO manager object.
    var room = io.sockets.adapter.rooms.get(data.gameId.toString());

    var playersJoined = numberOfUsersInRoom(data.gameId);

    if (playersJoined.length >= 4) {
        this.emit('error', { message: "Room already full." });
        return;
    }

    // If the room exists...
    if (room != undefined) {
        // attach the socket id to the data object.
        data.mySocketId = this.id;

        // Join the room
        this.join(data.gameId.toString());

        players.push(createPlayer(data.playerName, data.gameId, playersJoined.length + 1, data.mySocketId, false));

        data.players = numberOfUsersInRoom(data.gameId);

        rooms.push({ roomId: data.gameId.toString(), rounds: 0, currentGameRang: 'clubs', currentRoundRang: null, playersTurn: 0, roundStartPlayer: null, previousRoundWinner: null, nextPlayerTurn: null, selectionOfRangStarted: null });
        // Emit an event notifying the clients that the player has joined the room.
        io.to(data.gameId).emit('playerJoinedRoom', data);
        io.to(data.mySocketId).emit('updatePlayerId', { playerId: data.players.length });

        //if room full emit event
        console.log(data.players.length);
        if (data.players.length == 4)
            io.to(data.gameId).emit('roomfull', data);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error', { message: "This room does not exist." });
    }
}

function startGame(player) {
    console.log('Your turn called', player);

    var room = getRoomForCurrentGame(player.room);
    room.rounds = 1;
    room.playersTurn = 1;
    room.roundStartPlayer = room.playersTurn;
    room.previousRoundWinner = null;
    room.selectionOfRangStarted = null;
    rangSet = 1;
    io.to(player.room).emit('yourTurn', { playerId: player.playerId, clearCards: false });
}

function getCardForRangSelection(data) {
    var room = getRoomForCurrentGame(data.roomId);
    if (room.selectionOfRangStarted == null) {
        room.selectionOfRangStarted = true;
        var playersForRoom = numberOfUsersInRoom(data.roomId);
        var firstPlayer = playersForRoom.find((player) => player.playerId == 1);
        var firstFiveCards = deck.getCards(5);
        console.log("first five cards:", firstFiveCards);
        io.to(firstPlayer.socketId).emit('selectRangForGame', { socketId: firstPlayer.socketId, cards: firstFiveCards });
    }
}

function dealCardsToPlayers(data) {
    var playersForRoom = numberOfUsersInRoom(data.roomId);
    var room = getRoomForCurrentGame(data.roomId);

    room.currentGameRang = data.selectedRang.name;
    io.to(room.roomId).emit('rangSelected', { rang: room.currentGameRang });

    playersForRoom.forEach((player) => {
        if (!player.cardDealed) {
            if (player.playerId == 1) {
                var firstFiveCards = data.selectedCards;
                console.log(firstFiveCards);
                var restofTheCardsForPlayer = deck.getCards(8);
                io.to(player.socketId).emit('cardDealForPlayers', { socketId: player.socketId, cards: firstFiveCards.concat(restofTheCardsForPlayer) });
            }
            else {
                io.to(player.socketId).emit('cardDealForPlayers', { socketId: player.socketId, cards: deck.getCards(13) });
                player.cardDealed = true;
            }
        }
    });

    startGame(playersForRoom[0]);
}

function playedCard(data) {
    var room = getRoomForCurrentGame(data.roomId);
    if (room.currentRoundRang === null)
        room.currentRoundRang = data.card.name;
    playedCards.push({ playerData: data, round: room.rounds });

    var playersForRoom = numberOfUsersInRoom(room.roomId);

    playersForRoom.forEach((player) => {
        if (!data.playerId !== player.playerId) {
            io.to(player.socketId).emit('updateOtherPlayerCard', data);
        }
    });

    setTimeout(function () { whosTurn(room, playersForRoom); }, 2000);
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */
/*
* Shuffle the cards
* 
*/
function Deck() {
    this.cards = [];
    this.shuffle = function () {
        var j, x, i;
        for (i = this.cards.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = this.cards[i];
            this.cards[i] = this.cards[j];
            this.cards[j] = x;
        }
    }
    for (suit = 3; suit >= 0; suit--) {
        for (rank = 14; rank > 1; rank--) {
            this.cards.push({
                name: suits[suit],
                value: rank,
                class: "suit " + suits[suit]
            });
        }
    }
    this.sort = function (returnCards) {
        const groupById = (acc, item) => {
            const id = item.name;
            if (id in acc) {
                acc[id].push(item);
            } else {
                acc[id] = [item];
            }
            return acc;
        };
        const sortByNum = (a, b) => a.value - b.value;
        const sortByMinNum = (a, b) => a[0].value - b[0].value;

        const groups = Object.values(returnCards.reduce(groupById, {}))
            .map(group => group.sort(sortByNum))
            .sort(sortByMinNum);
        return [].concat(...groups);
    }
    this.getCards = function (number) {
        if (typeof number === 'undefined') number = 1;
        var returnCards = [];
        for (var i = number; i > 0; i--) {
            returnCards.push(this.cards.pop());
        }
        return this.sort(returnCards);
    }
    this.getCard = function () {
        return this.getCards(1);
    }
    this.shuffle();

}



function whosTurn(room, playersForRoom) {
    room.playersTurn = room.playersTurn >= playersForRoom.length ? 1 : room.playersTurn + 1;

    console.log("Who is players turn and startplayer: ", room.playersTurn, room.roundStartPlayer);

    if (room.playersTurn == room.roundStartPlayer) {
        var winner = whoWonTheRound(room, playersForRoom);
        console.log("Number of rounds: ", room.rounds);
        if (room.rounds == 13) {
            var gameWinner = whichTeamWonTheGame(room.roomId);
            resetGame(room);
            io.to(room.roomId).emit('endGame', { gameWinner: gameWinner });
            return;
        }
        else if ((room.rounds == 3 && room.previousRoundWinner !== null && room.previousRoundWinner.playerData.playerId == winner.playerData.playerId)
            || (room.rounds > 3 && room.previousRoundWinner !== null && room.previousRoundWinner.playerData.playerId == winner.playerData.playerId)) {
            rangSet = rangSet + 1;
            room.previousRoundWinner = null;
            io.to(room.roomId).emit("whoWonRound", { rangSet: rangSet, rounds: room.rounds, winner: winner, clearCards: true, playerId: winner.playerData.playerId });
        }
        else {
            room.previousRoundWinner = winner;
            io.to(room.roomId).emit('yourTurn', { playerId: winner.playerData.playerId, clearCards: true });
        }
        room.playersTurn = winner.playerData.playerId;
        room.roundStartPlayer = room.playersTurn;
        room.rounds = room.rounds + 1;
        room.currentRoundRang = null;
    }
    else {
        console.log('Whos turn', room.playersTurn);

        room.nextPlayerTurn = findAPlayerInRoom(room.roomId, room.playersTurn);

        io.to(room.nextPlayerTurn.room).emit('yourTurn', { playerId: room.nextPlayerTurn.playerId });
    }
}

function whoWonTheRound(room) {
    var cardsPlayedInCurrentRound = getCardsPlayedInRound(room.roomId);

    var largest = 0;
    var largestCard = null;
    var rangUsed = false;
    for (i = 0; i <= cardsPlayedInCurrentRound.length - 1; i++) {
        console.log("Played card and current round rang: ", cardsPlayedInCurrentRound[i].playerData.card.name, room.currentRoundRang);

        if (cardsPlayedInCurrentRound[i].playerData.card.name === room.currentRoundRang && !rangUsed) {
            if (cardsPlayedInCurrentRound[i].playerData.card.value > largest) {
                largestCard = cardsPlayedInCurrentRound[i];
                largest = cardsPlayedInCurrentRound[i].playerData.card.value;
            }
        }
        else if (cardsPlayedInCurrentRound[i].playerData.card.name === room.currentGameRang) {
            if (rangUsed) {
                if (cardsPlayedInCurrentRound[i].playerData.card.value > largest) {
                    largestCard = cardsPlayedInCurrentRound[i];
                    largest = cardsPlayedInCurrentRound[i].playerData.card.value;
                }
            } else {
                largestCard = cardsPlayedInCurrentRound[i];
                largest = cardsPlayedInCurrentRound[i].playerData.card.value;
                rangUsed = true;
            }
        }
    }
    console.log('Player won the round', largestCard);

    if (largestCard !== null)
        updatePlayerRounds(largestCard.playerData.playerId, room.roomId);

    return largestCard;
}

function whichTeamWonTheGame(roomId) {
    var player01 = findAPlayerInRoom(roomId, 1);
    var player02 = findAPlayerInRoom(roomId, 2);
    var player03 = findAPlayerInRoom(roomId, 3);
    var player04 = findAPlayerInRoom(roomId, 4);

    return (player01.roundsWon + player03.roundsWon) > (player02.roundsWon + player04.roundsWon)
        ? { playerNames: player01.playerName + " & " + player03.playerName, roundsWon: player01.roundsWon + player03.roundsWon }
        : { playerNames: player02.playerName + " & " + player04.playerName, roundsWon: player02.roundsWon + player04.roundsWon };
}

/* *************************
   *                       *
   *      Utility        *
   *                       *
   ************************* */

function resetGame(room) {
    room.rounds = 1;
    room.playersTurn = 1;
    room.roundStartPlayer = room.playersTurn;
    room.previousRoundWinner = null;
    rangSet = 1;
}

function updatePlayerRounds(playerId, roomId) {
    var player = findAPlayerInRoom(roomId, playerId);
    player.roundsWon = player.roundsWon + 1;
}

function createPlayer(playerName, thisGameId, playerId, socketId, cardDealed, isHost) {
    return { playerName: playerName, room: thisGameId.toString(), playerId: playerId, socketId: socketId, cardDealed: cardDealed, roundsWon: 0 };
}

function numberOfUsersInRoom(roomId) {
    return players.filter((obj) => obj.room === roomId);
}

function getRoomForCurrentGame(roomId) {
    return rooms.find((obj) => obj.roomId === roomId);
}

function findAPlayerInRoom(roomId, playerId) {
    return players.find((obj) => obj.room === roomId && obj.playerId == playerId);
}

function getCardsPlayedInRound(roomId) {
    var room = getRoomForCurrentGame(roomId);
    return playedCards.filter((obj) => obj.round === room.rounds);
}

