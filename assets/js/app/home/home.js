angular.module('home', []);

angular.module('home').config(['$routeProvider',
    function ($routeProvider) {
        $routeProvider.
            when('/', {
                templateUrl: 'js/app/home/views/home.view.html'
            }).
            when('/search', {
                templateUrl: 'js/app/home/views/search.view.html'
            }).
            otherwise({
                redirectTo: '/'
            });
    }
]);