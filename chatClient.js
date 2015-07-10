(function () {
    var app = angular.module('app', [
        'btford.socket-io'
        , 'luegg.directives'
    ]);

    app.factory('chat', function (socketFactory) {
        return socketFactory();
    });

    app.directive('maxHeight', function () {
        return {
            restrict: 'A',
            scope: {
                heightPercent: '='
            },
            link: function (scope, el, attrs) {
                var decHeightPercent = scope.heightPercent / 100;

                el.height($(window).height() * decHeightPercent);

                $(window).on('resize', function (){
                    el.height($(this).height() * decHeightPercent);
                })
            }
        }
    });

    var icons = {
        msg: 'http://cdn.sstatic.net/stackexchange/img/logos/so/so-icon.png',
        connected: 'http://simpleicon.com/wp-content/uploads/account.png',
        disconnected: 'http://simpleicon.com/wp-content/uploads/user-4.png',
        //tagged: 'http://simpleicon.com/wp-content/uploads/map-marker-14.png'
        tagged: 'http://simpleicon.com/wp-content/uploads/chat.png'
    };

    mainCtrl.$inject = ['$scope', 'chat'];
    app.controller('main', mainCtrl);
    function mainCtrl($scope, chat) {
        if(Notification.permission !== 'granted') {
            Notification.requestPermission();
        }

        $scope.errors = [];
        $scope.messages = [];
        $scope.users = [];

        $scope.$watch('color', function (a, b) {
            if($scope.color) {
                chat.emit('setColor', $scope.color);
            }
        });

        $scope.dismissError = function (err) {
            $scope.errors = $scope.errors.filter(function (item) {
                return item !== err;
            });
        };

        $scope.addTag = function (n) {
            if(!$scope.newMsg || $scope.newMsg.indexOf('@' + n) <= -1) {
                var pre = ($scope.newMsg && $scope.newMsg[$scope.newMsg.length -1]) !== ' ' ? ' @' : '@';
                $scope.newMsg = ($scope.newMsg || '') + pre + n;
            }
        };

        chat.on('msgExpired', function (id) {
            var found = $scope.messages.filter(function (item) {
                return item.id === id;
            })[0];

            if(found) {
                $scope.messages.splice($scope.messages.indexOf(found), 1);
            }
        });

        chat.on('age', function (time) {
            $scope.cacheAge = time;
        });

        chat.on('oops', function (err) {
            $scope.errors.push(err);
        });

        chat.on('userConnected', function (u) {
            var found = $scope.users.filter(function (item) {
                return item.id === u.id;
            })[0];

            if(found) {
                $scope.users.splice($scope.users.indexOf(found), 1);
            }

            $scope.users.push(u);var notification = new Notification(u + ' joined!', {
                icon: icons.connected,
                body: u + ' joined!'
            });

        });

        chat.on('userDisconnected', function (u) {
            var found = $scope.users.filter(function (item) {
                return item.id === u.id;
            })[0];

            if(found) {
                $scope.users.splice($scope.users.indexOf(found), 1);
            }

            $scope.users.push(u);

            var notification = new Notification(u + ' left!', {
                icon: icons.connected,
                body: u + ' left!'
            });
        });

        chat.on('users', function (data) {
            $scope.users = data;
        });

        chat.on('updateUser', function (u) {
            var found = $scope.users.filter(function (item) {
                return item.id === u.id;
            })[0];
            found.color = u.color;

            var fMsg = $scope.messages.filter(function (item) {
                return item.whoId === u.id;
            }).forEach(function (item) {
                item.color = u.color;
            });
        });

        chat.on('name', function (data) {
            $scope.name = data;
        });

        chat.on('history', function (h) {
            console.log(h);
            $scope.messages = h;
        });

        chat.on('msg', function (msg) {
            $scope.messages.push(msg);

            if(msg.msg.toLowerCase().indexOf('@' + $scope.name.toLowerCase())) {
                var notification = new Notification(msg.who + ' tagged you!', {
                    icon: icons.connected,
                    body: msg.msg
                });
            }
            // var prevTitle = document.title;
            // var interId = setInterval(function (){
            //     if(document.title === prevTitle) {
            //         document.title = msg.who + ' says: ' + msg.msg;
            //     } else {
            //         document.title = prevTitle;
            //     }
            // }, 500);
            // $(document).one('mouseover', function () {
            //     clearInterval(interId);
            //     document.title = prevTitle;
            // });
        });

        $scope.send = function (msg) {
            if($scope.newMsg && $scope.newMsg.length) {
                chat.emit('msg', $scope.newMsg)
                $scope.newMsg = null;
            }
        };

        $scope.setName = function (n) {
            if(n && n.trim().length > 0) {
                $scope.errors = $scope.errors.filter(function (item) {
                    return item.type !== 'setName';
                });

                chat.emit('init', {name: n});
            } else {
                $scope.errors.push({
                    type: 'setName',
                    msg: 'Please provide name.'
                });
            }
        };

        $scope.clearName = function () {
            $scope.name = null;
            chat.emit('clearName');
        }
    }
}());
