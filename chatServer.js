var Hapi = require('hapi');
var good = require('good');
var moment = require('moment');

var server = new Hapi.Server();
server.connection({
    // host: '204.10.223.176',
    port: 3000
});

var io = require('socket.io')(server.listener);
var curUserId = 0
    , curMsgId = 0
    , clients = []
    , history = []
    , cacheAge = 0
    , maxCacheAge = 900
    , maxTimeStr = getTime(maxCacheAge);

function getTime (sec) {
    var curMin = Math.floor(sec / 60);
    var curSec = (sec - (curMin * 60));
    return curMin + ':' + (curSec < 10 ? '0' + curSec : curSec);
}

setInterval(function () {
    var expired = history.filter(function (item) {
        var startDate = moment(item.when)
        var endDate = moment()
        var secDiff = endDate.diff(startDate, 'seconds')
        return secDiff >= maxCacheAge;
    });

    expired.forEach(function (item) {
        history.splice(history.indexOf(item), 1);
        io.emit('msgExpired', item.id);
    });


    // cacheAge += 1;
    // var curTime = getTime(cacheAge);
    // io.emit('age', curTime + '/' + maxTimeStr);
    // if(cacheAge === maxCacheAge) {
    //     cacheAge = 0;
    //     history = [];
    //     io.emit('history', history);
    // }
}, 1000);

io.on('connection', function (socket) {
    clients.push(socket);
    socket.chat = socket.chat || {};
    curUserId += 1;
    socket.chat.id = curUserId;

    console.log('someone connected', socket.conn.remoteAddress);
    socket.emit('hi', { hello: 'world' });

    socket.on('init', function (data) {

        //check if name in use
        var inUse = clients.filter(function (item) {
            return item.chat && item.chat.name === data.name;
        }).length;

        server.log('init', data);
        server.log('inUse', inUse);

        if(inUse) {
            socket.emit('oops', {
                type: 'setName',
                msg: 'Name is already in use.'
            });
            return;
        }

        socket.chat.name = data.name;

        socket.emit('name', data.name);

        socket.broadcast.emit('userConnected', socket.chat);

        var u = clients.map(function (item) {
            return item.chat;
        });
        socket.emit('users', u);
        socket.emit('history', history);
    });

    socket.on('setColor', function (c) {
        socket.chat.color = c;
        io.emit('updateUser', socket.chat);

        //update msg in history
        history.filter(function (item) {
            return item.whoId === socket.chat.id;
        }).forEach(function (item) {
            item.color = socket.chat.color;
        });
    });

    socket.on('clearName', function () {
        if(socket.chat.name) {
            socket.broadcast.emit('userDisconnected', socket.chat);
        }
        socket.chat.name = null;
    });

    socket.on('msg', function (msg) {
        curMsgId += 1;
        //server.log('msg', msg, socket.chat.name);
        var nMsg = {
            id: curMsgId,
            when: new Date(),
            whoId: socket.chat.id,
            who: socket.chat.name,
            color: socket.chat.color,
            msg: msg
        };

        io.emit('msg', nMsg);
        history.push(nMsg);
    });

    socket.on('disconnect', function () {
        server.log('disconnect', socket.chat.name);
        clients.splice(clients.indexOf(socket), 1);
        if(socket.chat.name) {
            socket.broadcast.emit('userDisconnected', socket.chat);
        }
    });
});

server.route({
    method: 'GET',
    path: '/',
    handler: function (req, reply) {
        reply.file('chat.html');
    }
});

server.route({
    method: 'GET',
    path: '/{file}',
    handler: {
        file: function (req) {
            server.log(req.params.file);
            return req.params.file;
        }
    }
});

// server.route({
//     method: 'GET',
//     path: '/{name}',
//     handler: function (req, reply) {
//         reply('Hello ' + encodeURIComponent(req.params.name));
//     }
// });

server.register({
    register: good,
    options: {
        reporters: [{
            reporter: require('good-console'),
            args: [{log: '*', response: '*'}]
        }]
    }
}, function (err) {
    if(err){
        throw err;
    }

    server.start(function () {
            server.log('Server running at:', server.info.uri);
    });
});



// var express = require('express');
// var app = express();//require('http').createServer(handler)
// //var io = require('socket.io')(app);
// // var fs = require('fs');
//
// app.get('/', function (req, res) {
//     res.send('hi');
// });
//
// var server = app.listen(3000, function () {
//     var host = server.address().address;
//     var port = server.address().port;
//
//     console.log('listening %s:%s', host, port);
// });


//
// app.listen(3000);
//
// function handler (req, res) {
//     fs.readFile(__dirname + '/chat.html',
//     function (err, data) {
//         if (err) {
//             res.writeHead(500);
//             return res.end('Error loading index.html');
//         }
//
//         res.writeHead(200);
//         res.end(data);
//     });
// }
//
// io.on('connection', function (socket) {
//     console.log('someone connected', socket.conn.remoteAddress);
//     socket.emit('hi', { hello: 'world' });
//     socket.on('broadcast', function (data) {
//         var d = JSON.parse(data);
//         console.log(d.Event, d.Data);
//         socket.broadcast.emit(d.Event, d.Data);
//         socket.broadcast.emit('everything', d);
//     });
// });
