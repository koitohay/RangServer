var io;
var gameSocket;
// declare card elements
const suits = ["spades", "diamonds", "clubs", "hearts"];
const values = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
];
// empty array to contain cards
var deck = null;
let players = [];
let playedCards = [];
let noOfRoundsWonByPlayers01 = 0;
let noOfRoundsWonByPlayers02 = 0;
let noOfRoundsWonByPlayers03 = 0;
let noOfRoundsWonByPlayers04 = 0;
let playersTurn = 1;
let roundStartPlayer = playersTurn;
let rounds = 0;
let currentRoundRang = null;
let currentGameRang = 'clubs';
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
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('dealCardsToPlayers', dealCardsToPlayers);
    gameSocket.on('playedCard', playedCard);
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

    players.push(createPlayer(data, thisGameId, 1, this.id, false, true));

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

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId) {
    console.log('Game Started.');
    //Shuffle, deal card and give the host player option to select rang and start game.
    //sendWord(0,gameId);
};

/**
 * A player answered correctly. Time for the next word.
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextRound(data) {
    if (data.round < wordPool.length) {
        // clear showed cards and set who is the one to start next round.
        //sendWord(data.round, data.gameId);
    } else {
        // If the current round exceeds the number of maximum rounds, send the 'gameOver' event.
        io.sockets.in(data.gameId).emit('gameOver', data);
    }
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

        players.push(createPlayer(data, data.gameId, playersJoined.length + 1, data.mySocketId, false));

        data.players = numberOfUsersInRoom(data.gameId);
        //console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

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


function dealCardsToPlayers(data) {
    var playersForRoom = numberOfUsersInRoom(data.roomId);

    playersForRoom.forEach((player) => {
        if (!player.cardDealed) {
            io.to(player.socketId).emit('cardDealForPlayers', { socketId: player.socketId, cards: deck.getCards(13) });
            player.cardDealed = true;
        }
    });

    startGame(playersForRoom[0]);
}

function playedCard(data) {

    if (currentRoundRang === null)
        currentRoundRang = data.card.name;
    playedCards.push({ playerData: data, round: rounds });

    var playersForRoom = numberOfUsersInRoom(data.roomId);

    playersForRoom.forEach((player) => {
        if (!data.playerId !== player.playerId) {
            io.to(player.socketId).emit('updateOtherPlayerCard', data);
        }
    });

    whosTurn(data.roomId);
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
    this.getCards = function (number) {
        if (typeof number === 'undefined') number = 1;
        var returnCards = [];
        for (var i = number; i > 0; i--) {
            returnCards.push(this.cards.pop());
        }
        return returnCards;
    }
    this.getCard = function () {
        return this.getCards(1);
    }
    this.shuffle();

}


function startGame(player) {
    console.log('Your turn called', player);
    rounds = rounds + 1;
    playersTurn = 1;
    roundStartPlayer = playersTurn;
    io.to(player.room).emit('yourTurn', { playerId: player.playerId });
}


function whosTurn(roomId) {

    if (rounds == 13) {
        endGame();
    }
    var playersForRoom = numberOfUsersInRoom(roomId);
    playersTurn = playersTurn >= playersForRoom.length ? 1 : playersTurn + 1;


    if (playersTurn == roundStartPlayer) {
        var winner = whoWonTheRound();
        io.to(roomId).emit("whoWonRound", winner);
        playersTurn = winner.playerData.playerId;
        roundStartPlayer = playersTurn;
        rounds = rounds + 1;
        currentRoundRang = null;
    }

    console.log('Whos turn', playersTurn);

    nextPlayerTurn = findAPlayerInRoom(roomId, playersTurn);

    io.to(nextPlayerTurn.room).emit('yourTurn', { playerId: nextPlayerTurn.playerId });
}

function whoWonTheRound() {
    var cardsPlayedInCurrentRound = getCardsPlayedInRound();
    console.log("Played cards: ", cardsPlayedInCurrentRound);

    var largest = 0;
    var largestCard = null;
    var rangUsed = false;
    for (i = 0; i <= cardsPlayedInCurrentRound.length - 1; i++) {
        if (cardsPlayedInCurrentRound[i].playerData.card.name === currentRoundRang && !rangUsed) {
            if (cardsPlayedInCurrentRound[i].playerData.card.value > largest) {
                largestCard = cardsPlayedInCurrentRound[i];
                largest = cardsPlayedInCurrentRound[i].playerData.card.value;
            }
        }
        else if (cardsPlayedInCurrentRound[i].playerData.card.name === currentGameRang) {
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

    //TODO: findout who is the winner
    switch (largestCard.playerData.playerId) {
        case 1:
            noOfRoundsWonByPlayers01 = noOfRoundsWonByPlayers01 + 1;
            break;
        case 2:
            noOfRoundsWonByPlayers02 = noOfRoundsWonByPlayers02 + 1;
            break;
        case 3:
            noOfRoundsWonByPlayers03 = noOfRoundsWonByPlayers03 + 1;
            break;
        case 4:
            noOfRoundsWonByPlayers04 = noOfRoundsWonByPlayers04 + 1;
            break;
        default:
            break;
    }
    return largestCard;
    // return cardsPlayedInCurrentRound.reduce((a, b) => a.playerData.card.value > b.playerData.card.value ? a : b);
}

function endGame() {

}

/* *************************
   *                       *
   *      Utility        *
   *                       *
   ************************* */


function createPlayer(data, thisGameId, playerId, socketId, cardDealed, isHost) {
    return { playerName: data.playerName, room: thisGameId.toString(), playerId: playerId, socketId: socketId, isHost: isHost, cardDealed: cardDealed };
}

function numberOfUsersInRoom(roomId) {
    return players.filter((obj) => obj.room === roomId);
}

function findAPlayerInRoom(roomId, playerId) {
    return players.find((obj) => obj.room === roomId && obj.playerId == playerId);
}

function getCardsPlayedInRound() {
    return playedCards.filter((obj) => obj.round === rounds);
}

