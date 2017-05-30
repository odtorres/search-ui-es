angular.module('home').service('SearchService', ['$http',
    function ($http) {
        this.someValue = true
        this.get= function (data) {            
            return $http({
                method: 'GET',
                url: '/search?q='+data
            })
        }
    }
]);